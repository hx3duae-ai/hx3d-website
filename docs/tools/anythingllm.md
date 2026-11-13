# AnythingLLM

**ما هو؟** تطبيق مفتوح المصدر للمحادثة مع مستنداتك (PDF، Word، مواقع…) وبناء وكلاء AI داخل مساحات عمل (workspaces). يعمل محلياً افتراضياً، ويدعم نماذج LLM متعددة (محلية أو عبر API).

**المستودع:** https://github.com/Mintplex-Labs/anything-llm

## طرق التشغيل

### 1. التطبيق الجاهز (الأسهل)
حمّل النسخة المكتبية (Mac / Windows / Linux) من الموقع الرسمي للمشروع، وشغّلها. لا تحتاج أي إعداد تقني.

### 2. Docker (للاستضافة الذاتية أو للفريق)
الإعدادات موجودة في مجلد `docker/` داخل المستودع. الخطوات العامة:
```bash
git clone https://github.com/Mintplex-Labs/anything-llm.git
cd anything-llm/docker
cp .env.example .env      # عدّل المفاتيح والإعدادات
docker compose up -d
```
تحقق من `docker-compose.yml` و `README` داخل مجلد `docker/` لمعرفة المنفذ (port) الصحيح. الميزات مثل تعدد المستخدمين والتخصيص (white-labeling) متاحة في نسخة Docker فقط.

### 3. وضع التطوير (من المصدر)
```bash
git clone https://github.com/Mintplex-Labs/anything-llm.git
cd anything-llm
yarn setup              # ينشئ ملفات .env المطلوبة لكل قسم، عبّئها قبل المتابعة
yarn dev:server         # تشغيل الخادم
yarn dev:frontend       # تشغيل الواجهة
yarn dev:collector      # تشغيل معالج المستندات
```
تحتاج Node.js حسب ما يحدده ملف `.node-version` في المستودع.

## ملاحظات
- **الخصوصية:** التطبيق يرسل تليمتري مجهولة افتراضياً. لإيقافها ضع `DISABLE_TELEMETRY=true` في ملف `.env`، أو من داخل التطبيق: القائمة الجانبية ← Privacy.
- **مفاتيح النماذج:** إذا استخدمت نموذج عبر API (OpenAI أو غيره)، المفتاح يُدخل في الإعدادات ولا يُحفظ داخل المستودع.
- **هذا المشروع منفصل تماماً عن موقع HX 3D (hx-os)**، ولا يُشغَّل من داخله.
