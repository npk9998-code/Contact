const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

/**
 * يتحقق من صلاحية JWT ووجود الجلسة في قاعدة البيانات
 * (يسمح بإلغاء الجلسات من السيرفر فوراً عبر حذف الـ Session)
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'لم يتم تسجيل الدخول' });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'الجلسة منتهية أو غير صالحة' });
    }

    const session = await prisma.session.findUnique({ where: { token } });
    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'الجلسة منتهية، يرجى تسجيل الدخول مرة أخرى' });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: decoded.id },
      include: {
        permissions: true,
        assignedLines: { include: { line: true } },
      },
    });

    if (!employee || !employee.isActive) {
      return res.status(401).json({ error: 'الحساب غير مفعّل' });
    }

    req.employee = {
      id: employee.id,
      orgId: employee.orgId,
      name: employee.name,
      role: employee.role,
      permissions: employee.permissions,
      lines: employee.assignedLines.map(el => ({
        id: el.line.id,
        name: el.line.name,
        displayNumber: el.line.displayNumber,
        type: el.line.type,
        color: el.line.color,
        canCall: el.canCall,
        canChat: el.canChat,
        isDefault: el.isDefault,
      })),
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * يتأكد أن الموظف لديه صلاحية معينة على مورد معين
 * استخدام: requirePermission('lines', 'write')
 */
function requirePermission(resource, level = 'read') {
  return (req, res, next) => {
    if (req.employee.role === 'SUPER_ADMIN' || req.employee.role === 'ADMIN') {
      return next();
    }
    const perm = req.employee.permissions.find(p => p.resource === resource);
    const allowed = perm && {
      read: perm.canRead,
      write: perm.canWrite,
      delete: perm.canDelete,
    }[level];

    if (!allowed) {
      return res.status(403).json({ error: 'لا تملك صلاحية الوصول لهذا المورد' });
    }
    next();
  };
}

/**
 * يتأكد أن الموظف لديه صلاحية الوصول للخط (line) المحدد
 * يقرأ lineId من header X-Line-ID
 */
function requireLineAccess(req, res, next) {
  const lineId = req.headers['x-line-id'];
  if (!lineId) {
    return res.status(400).json({ error: 'يجب تحديد الخط (X-Line-ID header)' });
  }

  if (req.employee.role === 'SUPER_ADMIN' || req.employee.role === 'ADMIN') {
    req.activeLineId = lineId;
    return next();
  }

  const hasAccess = req.employee.lines.some(l => l.id === lineId);
  if (!hasAccess) {
    return res.status(403).json({ error: 'لا تملك صلاحية الوصول لهذا الخط' });
  }

  req.activeLineId = lineId;
  next();
}

module.exports = { authenticate, requirePermission, requireLineAccess };
