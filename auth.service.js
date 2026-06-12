const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../../config/database');
const { sendOtpSms } = require('./sms.service');
const logger = require('../../config/logger');

const OTP_EXPIRES_MIN = parseInt(process.env.OTP_EXPIRES_MINUTES) || 5;
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS) || 3;

function generateOtpCode() {
  // كود من 6 أرقام
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * الخطوة 1 من تسجيل الدخول:
 * يتحقق من رقم الجوال + كلمة السر، ثم يرسل OTP
 */
async function requestLogin(phone, password) {
  const employee = await prisma.employee.findUnique({ where: { phone } });

  if (!employee || !employee.isActive) {
    throw new AuthError('بيانات الدخول غير صحيحة', 401);
  }

  const validPassword = await bcrypt.compare(password, employee.passwordHash);
  if (!validPassword) {
    throw new AuthError('بيانات الدخول غير صحيحة', 401);
  }

  // إنشاء كود OTP
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MIN * 60 * 1000);

  await prisma.otpCode.create({
    data: { employeeId: employee.id, code, expiresAt },
  });

  await sendOtpSms(employee.phone, code);

  return { employeeId: employee.id, message: 'تم إرسال رمز التحقق إلى جوالك' };
}

/**
 * الخطوة 2: التحقق من كود OTP وإصدار JWT
 */
async function verifyOtp(employeeId, code, deviceInfo, ip) {
  const otpRecord = await prisma.otpCode.findFirst({
    where: { employeeId, used: false },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord) {
    throw new AuthError('لم يتم العثور على رمز تحقق صالح', 400);
  }

  if (otpRecord.expiresAt < new Date()) {
    throw new AuthError('انتهت صلاحية رمز التحقق، يرجى طلب رمز جديد', 400);
  }

  if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AuthError('تم تجاوز عدد المحاولات المسموح، يرجى طلب رمز جديد', 429);
  }

  if (otpRecord.code !== code) {
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AuthError('رمز التحقق غير صحيح', 400);
  }

  // الكود صحيح
  await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { used: true } });

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      permissions: true,
      assignedLines: { include: { line: true } },
    },
  });

  await prisma.employee.update({
    where: { id: employeeId },
    data: { lastLogin: new Date() },
  });

  // إصدار JWT
  const token = jwt.sign(
    { id: employee.id, orgId: employee.orgId, role: employee.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 8);

  await prisma.session.create({
    data: { employeeId, token, deviceInfo, ip, expiresAt },
  });

  return {
    token,
    employee: {
      id: employee.id,
      name: employee.name,
      phone: employee.phone,
      role: employee.role,
      avatar: employee.avatar,
      permissions: employee.permissions,
      lines: employee.assignedLines.map(el => ({
        ...el.line,
        canCall: el.canCall,
        canChat: el.canChat,
        isDefault: el.isDefault,
        // لا نُرجع المفاتيح الحساسة للـ frontend
        twilioAuthToken: undefined,
        waAccessToken: undefined,
        waWebhookSecret: undefined,
      })),
    },
  };
}

async function logout(token) {
  await prisma.session.deleteMany({ where: { token } });
}

async function resendOtp(employeeId) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new AuthError('موظف غير موجود', 404);

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MIN * 60 * 1000);

  await prisma.otpCode.create({ data: { employeeId, code, expiresAt } });
  await sendOtpSms(employee.phone, code);

  return { message: 'تم إعادة إرسال رمز التحقق' };
}

class AuthError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = { requestLogin, verifyOtp, logout, resendOtp, AuthError };
