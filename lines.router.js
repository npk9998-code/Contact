const express = require('express');
const router = express.Router();
const linesService = require('./lines.service');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');

router.use(authenticate);

// قائمة الخطوط المتاحة للموظف الحالي -> تغذي "محول الحسابات" في الواجهة
router.get('/', async (req, res, next) => {
  try {
    const lines = await linesService.getMyLines(req.employee);
    res.json({ lines });
  } catch (err) {
    next(err);
  }
});

// إنشاء خط/رقم جديد (Admin)
router.post('/', requirePermission('lines', 'write'), async (req, res, next) => {
  try {
    const line = await linesService.createLine(req.employee.orgId, req.body);
    res.status(201).json({ line });
  } catch (err) {
    next(err);
  }
});

// تحديث إعدادات خط (Admin) — يشمل إعدادات IVR، الرد الآلي، ساعات العمل
router.patch('/:id', requirePermission('lines', 'write'), async (req, res, next) => {
  try {
    const line = await linesService.updateLine(req.params.id, req.employee.orgId, req.body);
    res.json({ line });
  } catch (err) {
    next(err);
  }
});

// تعطيل خط (Admin)
router.delete('/:id', requirePermission('lines', 'delete'), async (req, res, next) => {
  try {
    const result = await linesService.deactivateLine(req.params.id, req.employee.orgId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ربط موظف بخط + تحديد صلاحياته (Admin)
router.post('/:id/employees/:employeeId', requirePermission('lines', 'write'), async (req, res, next) => {
  try {
    const link = await linesService.assignEmployeeToLine(
      req.params.id,
      req.params.employeeId,
      req.employee.orgId,
      req.body
    );
    res.json({ link });
  } catch (err) {
    next(err);
  }
});

// إلغاء ربط موظف بخط (Admin)
router.delete('/:id/employees/:employeeId', requirePermission('lines', 'write'), async (req, res, next) => {
  try {
    const result = await linesService.unassignEmployeeFromLine(
      req.params.id,
      req.params.employeeId,
      req.employee.orgId
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
