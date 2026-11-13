# Sellbird

**ما هو؟** منصة Outreach مفتوحة المصدر (كانت تسمى Harvey). تجد الشركات التي تحتاج ما تبيعه، وتجد صاحب القرار، وتتحقق من بريده، وتكتب له إيميل بارد شخصي، وترسله بعد موافقتك، وتتعامل مع الردود. تعمل على اشتراك Claude Pro/Max أو ChatGPT (عبر Codex) بدون مفتاح API.

**المستودع:** https://github.com/ethanplusai/sellbird
**الموقع المستضاف:** https://sellbird.ai (وصول مبكر)

## المتطلبات
- **Python 3.11+** (على macOS استخدم `python3.13` لأن `python3` قد يكون 3.9)
- **Claude Pro أو Max** مع Claude CLI مسجّل الدخول (`claude login`)، أو خطة ChatGPT مع Codex CLI
- **صندوق بريد للإرسال** — يُفضل Google Workspace على نطاق إرسال منفصل. Microsoft 365 و SMTP مدعومان أيضاً.
- **تسخين (warmup) للبريد الجديد** قبل الإرسال البارد

## التثبيت والتشغيل
```bash
git clone https://github.com/ethanplusai/sellbird.git
cd sellbird
python3.13 -m venv .venv && source .venv/bin/activate && pip install -e .

cp .env.example .env && $EDITOR .env     # بيانات البريد والإعدادات (كل متغير موثّق داخل الملف)

sellbird train https://your-company.com   # يتعلم منتجك من موقعك ويكتب sellbird.local.yaml
sellbird signals --confirm free           # تأكيد ما يجعل العميل "مناسباً"
sellbird discover                         # البحث عن الشركات (المصدر الافتراضي مجاني)

sellbird dashboard                        # لوحة التحكم على http://127.0.0.1:5555
sellbird run                              # تشغيل الحلقة
```
بديل: Docker (على Linux)، والتفاصيل في `docs/docker.md` داخل المستودع.

## القواعد المهمة
- **لا شيء يُرسل بدون موافقتك** افتراضياً: كل إيميل ينتظر في Outbox حتى توافق عليه. وضع Autopilot تفعّله أنت يدوياً.
- `sellbird sending pause` يوقف الإرسال فوراً.
- **الامتثال:** الإيميل البارد يخضع لقواعد CAN-SPAM و GDPR وقوانين الإمارات المتعلقة بالخصوصية. راجع `docs/deliverability.md` قبل أي حملة، وأضف رابط إلغاء الاشتراك وهوية المرسل.
- **لا تحمّل بيانات تواصل حقيقية داخل المستودع**، واستخدم ملفات `*.local.yaml` و `.env` فقط (مستثناة من Git).
- **روابط الشريك:** بعض الروابط داخل المشروع (مثل TrulyInbox للتسخين) روابط إحالة، والمشروع يذكر أن صاحبه قد يحصل على عمولة بدون تكلفة إضافية عليك.
- **الترخيص:** AGPL-3.0 من الإصدار 0.4.0 فما بعد.

**هذا المشروع منفصل تماماً عن موقع HX 3D (hx-os)**، ولا يُشغَّل من داخله.
