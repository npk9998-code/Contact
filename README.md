# هاتف — Backend (الجزء 1 من 5)

هذا أول جزء من نظام "هاتف" — نظام الاتصال السحابي الداخلي.

## ما يحتويه هذا الجزء

✅ قاعدة بيانات كاملة (Prisma schema) — المؤسسة، الموظفون، الصلاحيات، الجلسات
✅ نظام مصادقة بخطوتين: كلمة سر + OTP عبر SMS
✅ Multi-Account Switcher (تعدد الأرقام/الخطوط) — الـ API الكامل
✅ تشفير مفاتيح Twilio/WhatsApp قبل حفظها في قاعدة البيانات
✅ نظام صلاحيات (Permissions) لكل موظف على كل مورد
✅ بيانات تجريبية (seed) لبدء الاختبار فوراً

## الأجزاء القادمة (سأبنيها بعد هذا الجزء)

🔜 الجزء 2: المكالمات + Twilio + IVR Designer
🔜 الجزء 3: واتساب المشترك + Meta API
🔜 الجزء 4: الذكاء الاصطناعي (تلخيص + تحليل مشاعر) + OpenAI
🔜 الجزء 5: الواجهة الأمامية (Next.js) كاملة

## التشغيل المحلي

### 1. المتطلبات
- Node.js 18+
- PostgreSQL (محلي أو على VPS)

### 2. التثبيت
```bash
cd backend
npm install
cp .env.example .env
```

### 3. ملف البيئة (.env)
ستجد ملف اسمه **`.env.READY`** في هذا المجلد — هذا هو ملف الإعدادات الجاهز والمضبوط (Neon + المفاتيح مولّدة).

داخل Codespaces، في الـ Terminal نفّذ:
```bash
mv .env.READY .env
```
هذا يحوّله إلى `.env` (وهو الاسم الذي يقرأه الكود)، وبما أنه يبدأ بنقطة فهو "مخفي" تلقائياً ومستثنى من Git عبر `.gitignore`.

✅ هذا الملف **جاهز ومضبوط بالفعل** — يحتوي على:
- رابط قاعدة بيانات Neon
- `JWT_SECRET` و `ENCRYPTION_KEY` مولّدة وجاهزة

⚠️ **يتبقى فقط**: تعبئة بيانات Twilio (أو بوابة SMS محلية) في الأسفل، وإلا فإن إرسال رمز OTP عند تسجيل الدخول لن يعمل. يمكنك تجاهل هذا مؤقتاً لتجربة باقي النظام أولاً.

### 4. إنشاء قاعدة البيانات
```bash
npx prisma migrate dev --name init
```

### 5. تشغيل البيانات التجريبية
**مهم:** افتح `prisma/seed.js` وغيّر أرقام الجوال (`+966500000001` و `+966500000002`)
إلى أرقامك الحقيقية لاستقبال رسائل OTP، ثم:
```bash
node prisma/seed.js
```

### 6. التشغيل
```bash
npm run dev
```
السيرفر يعمل على: `http://localhost:3001`

## تجربة تسجيل الدخول (مثال بـ curl)

```bash
# الخطوة 1: تسجيل الدخول
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+966500000001","password":"ChangeMe123!"}'

# سيرجع employeeId ويرسل OTP لجوالك
# الخطوة 2: التحقق من الكود
curl -X POST http://localhost:3001/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"...","code":"123456"}'

# سيرجع JWT token
# الخطوة 3: عرض الخطوط المتاحة (Multi-Account Switcher)
curl http://localhost:3001/api/lines \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## ملاحظة أمنية
- لا تشارك ملف `.env` أبداً
- استخدم Cloudflare Tunnel لإخفاء السيرفر عن الإنترنت العام (يُشرح في الجزء النهائي)
