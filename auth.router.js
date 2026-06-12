const express = require('express');
const router = express.Router();
const authService = require('./auth.service');
const { authenticate } = require('../../middleware/auth.middleware');

// الخطوة 1: تسجيل الدخول (جوال + كلمة سر) -> يرسل OTP
router.post('/login', async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'الجوال وكلمة السر مطلوبان' });
    }
    const result = await authService.requestLogin(phone, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// الخطوة 2: التحقق من OTP -> إصدار JWT
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { employeeId, code } = req.body;
    if (!employeeId || !code) {
      return res.status(400).json({ error: 'employeeId والكود مطلوبان' });
    }
    const deviceInfo = req.headers['user-agent'];
    const ip = req.ip;
    const result = await authService.verifyOtp(employeeId, code, deviceInfo, ip);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// إعادة إرسال الكود
router.post('/resend-otp', async (req, res, next) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) return res.status(400).json({ error: 'employeeId مطلوب' });
    const result = await authService.resendOtp(employeeId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// تسجيل الخروج
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    await authService.logout(token);
    res.json({ message: 'تم تسجيل الخروج' });
  } catch (err) {
    next(err);
  }
});

// معلومات الموظف الحالي (للتحقق من صلاحية الجلسة)
router.get('/me', authenticate, async (req, res) => {
  res.json({ employee: req.employee });
});

module.exports = router;
