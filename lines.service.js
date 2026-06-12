const prisma = require('../../config/database');
const { encrypt, decrypt } = require('../../config/crypto');

/**
 * يرجع جميع الخطوط التي يملك الموظف صلاحية الوصول لها
 * هذا ما يغذي "محول الحسابات" (Account Switcher) في الواجهة
 */
async function getMyLines(employee) {
  if (employee.role === 'SUPER_ADMIN' || employee.role === 'ADMIN') {
    const lines = await prisma.line.findMany({
      where: { orgId: employee.orgId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: safeLineSelect,
    });
    return lines;
  }

  const assigned = await prisma.employeeLine.findMany({
    where: { employeeId: employee.id, line: { isActive: true } },
    include: { line: { select: safeLineSelect } },
    orderBy: { line: { sortOrder: 'asc' } },
  });

  return assigned.map(a => ({
    ...a.line,
    canCall: a.canCall,
    canChat: a.canChat,
    isDefault: a.isDefault,
  }));
}

// لا نُرجع المفاتيح الحساسة (Twilio/WhatsApp tokens) للواجهة أبداً
const safeLineSelect = {
  id: true,
  name: true,
  displayNumber: true,
  type: true,
  isActive: true,
  sortOrder: true,
  color: true,
  description: true,
  ivrEnabled: true,
  greetingText: true,
  afterHoursMsg: true,
  workHoursStart: true,
  workHoursEnd: true,
  workDays: true,
  maxWaitSeconds: true,
  maxRings: true,
  twilioPhoneNumber: true,
  wabaId: true,
};

/**
 * إنشاء خط/رقم جديد (Admin فقط)
 */
async function createLine(orgId, data) {
  const {
    name, displayNumber, type, color, description,
    twilioAccountSid, twilioAuthToken, twilioPhoneNumber,
    wabaId, waPhoneNumberId, waAccessToken, waWebhookSecret,
  } = data;

  const line = await prisma.line.create({
    data: {
      orgId,
      name,
      displayNumber,
      type,
      color,
      description,
      // تشفير المفاتيح الحساسة قبل الحفظ
      twilioAccountSid: twilioAccountSid || null,
      twilioAuthToken: twilioAuthToken ? encrypt(twilioAuthToken) : null,
      twilioPhoneNumber: twilioPhoneNumber || null,
      wabaId: wabaId || null,
      waPhoneNumberId: waPhoneNumberId || null,
      waAccessToken: waAccessToken ? encrypt(waAccessToken) : null,
      waWebhookSecret: waWebhookSecret ? encrypt(waWebhookSecret) : null,
    },
    select: safeLineSelect,
  });

  return line;
}

/**
 * تحديث خط (إعدادات IVR، الرد الآلي، إلخ)
 */
async function updateLine(lineId, orgId, data) {
  const line = await prisma.line.findFirst({ where: { id: lineId, orgId } });
  if (!line) {
    const err = new Error('الخط غير موجود');
    err.statusCode = 404;
    throw err;
  }

  const updateData = { ...data };

  // إعادة تشفير المفاتيح الحساسة إن تم تغييرها
  if (data.twilioAuthToken) updateData.twilioAuthToken = encrypt(data.twilioAuthToken);
  if (data.waAccessToken) updateData.waAccessToken = encrypt(data.waAccessToken);
  if (data.waWebhookSecret) updateData.waWebhookSecret = encrypt(data.waWebhookSecret);

  const updated = await prisma.line.update({
    where: { id: lineId },
    data: updateData,
    select: safeLineSelect,
  });

  return updated;
}

/**
 * حذف (تعطيل) خط
 */
async function deactivateLine(lineId, orgId) {
  const line = await prisma.line.findFirst({ where: { id: lineId, orgId } });
  if (!line) {
    const err = new Error('الخط غير موجود');
    err.statusCode = 404;
    throw err;
  }
  await prisma.line.update({ where: { id: lineId }, data: { isActive: false } });
  return { message: 'تم تعطيل الخط' };
}

/**
 * ربط/تحديث صلاحيات موظف على خط معين
 */
async function assignEmployeeToLine(lineId, employeeId, orgId, { canCall = true, canChat = true, isDefault = false } = {}) {
  const line = await prisma.line.findFirst({ where: { id: lineId, orgId } });
  if (!line) {
    const err = new Error('الخط غير موجود');
    err.statusCode = 404;
    throw err;
  }

  const employee = await prisma.employee.findFirst({ where: { id: employeeId, orgId } });
  if (!employee) {
    const err = new Error('الموظف غير موجود');
    err.statusCode = 404;
    throw err;
  }

  // إن كان هذا الخط هو الافتراضي الجديد، ألغِ الافتراضي القديم
  if (isDefault) {
    await prisma.employeeLine.updateMany({
      where: { employeeId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const link = await prisma.employeeLine.upsert({
    where: { employeeId_lineId: { employeeId, lineId } },
    create: { employeeId, lineId, canCall, canChat, isDefault },
    update: { canCall, canChat, isDefault },
  });

  return link;
}

async function unassignEmployeeFromLine(lineId, employeeId, orgId) {
  const line = await prisma.line.findFirst({ where: { id: lineId, orgId } });
  if (!line) {
    const err = new Error('الخط غير موجود');
    err.statusCode = 404;
    throw err;
  }

  await prisma.employeeLine.deleteMany({ where: { employeeId, lineId } });
  return { message: 'تم إلغاء ربط الموظف بالخط' };
}

/**
 * يُستخدم داخلياً (مثلاً في خدمات Twilio/WhatsApp) لجلب المفاتيح الحقيقية بعد فك التشفير
 * لا يُستخدم هذا أبداً في استجابات الـ API
 */
async function getLineCredentials(lineId) {
  const line = await prisma.line.findUnique({ where: { id: lineId } });
  if (!line) return null;

  return {
    ...line,
    twilioAuthToken: line.twilioAuthToken ? decrypt(line.twilioAuthToken) : null,
    waAccessToken: line.waAccessToken ? decrypt(line.waAccessToken) : null,
    waWebhookSecret: line.waWebhookSecret ? decrypt(line.waWebhookSecret) : null,
  };
}

module.exports = {
  getMyLines,
  createLine,
  updateLine,
  deactivateLine,
  assignEmployeeToLine,
  unassignEmployeeFromLine,
  getLineCredentials,
};
