// بيانات تجريبية لبدء الاختبار
// تشغيل: node prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // 1. إنشاء المؤسسة
  const org = await prisma.organization.create({
    data: { name: 'شركتي' },
  });
  console.log('✅ Organization created:', org.id);

  // 2. إنشاء حساب المدير (Admin)
  // غيّر رقم الجوال وكلمة السر هنا قبل التشغيل
  const adminPassword = await bcrypt.hash('ChangeMe123!', 10);
  const admin = await prisma.employee.create({
    data: {
      orgId: org.id,
      name: 'المدير',
      phone: '+966500000001', // ← غيّر هذا لرقمك الحقيقي لاستقبال OTP
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin created:', admin.phone, '(password: ChangeMe123!)');

  // 3. إنشاء موظف عادي (Agent) كمثال
  const agentPassword = await bcrypt.hash('AgentPass123!', 10);
  const agent = await prisma.employee.create({
    data: {
      orgId: org.id,
      name: 'موظف المبيعات',
      phone: '+966500000002', // ← غيّر هذا
      passwordHash: agentPassword,
      role: 'AGENT',
      permissions: {
        create: [
          { resource: 'calls', canRead: true, canWrite: true },
          { resource: 'whatsapp', canRead: true, canWrite: true },
          { resource: 'clients', canRead: true, canWrite: true },
        ],
      },
    },
  });
  console.log('✅ Agent created:', agent.phone, '(password: AgentPass123!)');

  // 4. إنشاء خطين تجريبيين (لتجربة Multi-Account Switcher)
  const salesLine = await prisma.line.create({
    data: {
      orgId: org.id,
      name: 'خط المبيعات',
      displayNumber: '+966920000001',
      type: 'BOTH',
      color: '#4d9fff',
      sortOrder: 1,
      greetingText: 'أهلاً بكم في قسم المبيعات',
    },
  });

  const supportLine = await prisma.line.create({
    data: {
      orgId: org.id,
      name: 'خط الدعم الفني',
      displayNumber: '+966920000002',
      type: 'BOTH',
      color: '#34d058',
      sortOrder: 2,
      greetingText: 'أهلاً بكم في الدعم الفني',
    },
  });

  console.log('✅ Lines created:', salesLine.name, '&', supportLine.name);

  // 5. ربط الموظفين بالخطوط
  // المدير يصل لكل الخطوط تلقائياً (دوره ADMIN)
  // الموظف العادي: نربطه بخط المبيعات فقط كـ default
  await prisma.employeeLine.create({
    data: { employeeId: agent.id, lineId: salesLine.id, isDefault: true },
  });
  await prisma.employeeLine.create({
    data: { employeeId: agent.id, lineId: supportLine.id },
  });

  console.log('✅ Employee-Line assignments created');
  console.log('\n🎉 Seed completed!\n');
  console.log('سجل الدخول بأحد الحسابات التالية:');
  console.log(`  Admin: ${admin.phone} / ChangeMe123!`);
  console.log(`  Agent: ${agent.phone} / AgentPass123!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
