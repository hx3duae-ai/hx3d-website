# HX OS V2 — دليل التركيب

✅ = موجود في المستودع ويشتغل · 👤 = خطوة تسويها أنت في claude.ai أو الحسابات (Claude ما يقدر يسويها نيابة عنك) · 🔜 = المرحلة الجاية

---

## المرحلة 1 — Instagram (OOTTO) ✅ + 👤

### اللي انبنى
- **`.mcp.json`**: يضيف OOTTO (`https://mcp.ootto.ai/mcp`) لـ Claude Code داخل هذا المستودع.
- **4 وكلاء** في `.claude/agents/`:
  | الوكيل | الشغل |
  |---|---|
  | `ig-metrics` | Followers / Views / Reach / Saves / Shares / Top Reel ← يحفظها في HX OS ويجاوب أي سؤال عن الأداء |
  | `ig-inbox` | يرد على الرسائل، يؤهل الليد، يسعّر ويقفل البيعة، ويحدّث CRM |
  | `ig-scheduler` | 7 بوستات بالأسبوع (4 ريلز + 3 كاروسيل) من Content OS ← OOTTO بعد موافقتك |
  | `ig-comment-dm` | أي تعليق فيه «سعر / INFO / price / بكم…» ← كتالوج HX3D بالخاص + ليد في CRM |
- **صفحة `/instagram` في HX OS**: 4 تبويبات، funnel من التعليق إلى المبيعات بالدرهم، إعدادات الكلمات والكتالوج وأوقات النشر، وزر محاكاة تعليق.
- **API**: `POST /api/instagram/inbound` (يمنع التكرار، يطابق الكلمات بالعربي والإنجليزي، ينشئ الليد)، `events` (طابور الإرسال)، `posts` (الجدولة)، `metrics`.
- **احتياطي بدون OOTTO**: Webhook ميتا مباشر `GET/POST /api/webhooks/meta` (موقّع بـ `X-Hub-Signature-256`) + إرسال مباشر عبر Graph API إذا حطيت `META_PAGE_TOKEN` و`IG_USER_ID`.

### 👤 المطلوب منك
1. **تفعيل OOTTO**: افتح المستودع في Claude Code على جهازك ← وافق على خادم `ootto` لما يسألك ← `/mcp` ← `ootto` ← Authenticate وسجّل دخول حساب انستقرام البزنس.
   - تبي OOTTO في claude.ai بعد؟ Settings ← Connectors ← Add custom connector ← `https://mcp.ootto.ai/mcp`.
   - ملاحظة: جلسة السحابة الحالية ما قدرت توصل `ootto.ai` (محجوب في إعدادات الشبكة)، فما قدرت أجرب أدوات OOTTO نفسها. الوكلاء مكتوبين بحيث يكتشفون أدوات `mcp__ootto__*` أول ما يشتغلون.
2. **رابط الكتالوج**: `/instagram` ← Comment → DM ← حط رابط PDF / Drive للكتالوج واضغط حفظ.
3. **التشغيل**:
   ```bash
   cd hx-os && npm install && npm run dev     # http://localhost:3100/instagram
   claude                                      # من جذر المستودع
   > استخدم ig-comment-dm وشيك التعليقات الجديدة
   > استخدم ig-metrics: كيف كان أداء الأسبوع؟
   > استخدم ig-scheduler وخطط الأسبوع الجاي
   ```
   تشغيل دوري: `/loop 15m استخدم ig-comment-dm` داخل Claude Code.

## المرحلة 2 — CRM + Cal.com ✅ (مربوط بانستقرام)
- كل ليد من انستقرام ينزل في CRM بمصدر «انستقرام» واسم الحساب (رابط @handle في الجدول)، ونفس الشخص ما يتكرر (igUserId / handle).
- نوع الطلب ينحزر من الرسالة (درع ← هدايا شركات، فيلا ← مجسم معماري…).
- مبيعات انستقرام المسلّمة تظهر في funnel صفحة `/instagram`.
- Cal.com كما هو: `CAL_API_KEY` للسحب أو Webhook `/api/webhooks/calcom`.

🔜 الباقي من المرحلة 2: Google Flow (Video Studio)، Codex/Client Hunter، Second Brain — الصفحات موجودة كـ «قريباً» في HX OS.

## المرحلة 3 — Founder & Design 🔜
Founder Skill (11 دور: مجلس إدارة بأسلوب Jobs/Hormozi، CFO، تسويق، محاكاة عميل)، interface design / UI-UX Pro Max / web artifacts builder، وموصّل CranL GitHub.

## المرحلة 4 — إعداد claude.ai 👤
هذي إعدادات حسابك، ما تنسوى من الكود:

### 1. Instructions (Settings ← Profile ← «What personal preferences…»)
انسخ والصق:
```
أنا مؤسس HX 3D Dubai (HX 3D UAE) — طباعة ثلاثية الأبعاد في دبي: هدايا شركات، مجسمات معمارية، منتجات ونماذج أولية. أطبع على Bambu Lab P2S + AMS.
كلمني بالعربي بلهجة إماراتية خفيفة، مختصر ومباشر. الأسعار بالدرهم، التوقيت دبي.
قناة المبيعات الأساسية انستقرام (OOTTO) ← CRM في HX OS ← Cal.com.
لا تنشر ولا ترسل شي باسمي بدون موافقتي.
```

### 2. Connectors (Settings ← Connectors)
- **Gmail** — متصل ✅ (أدواته ظاهرة في هذي الجلسة).
- **Google Drive**, **Google Calendar**, **Notion** — اضغط Connect لكل واحد وسجّل دخول.
- **OOTTO** — Add custom connector ← `https://mcp.ootto.ai/mcp`.
- **GitHub** — موصّل plugin:github ما اتصل في هذي الجلسة (خطأ بروكسي)؛ أعد ربطه من Settings ← Connectors.

### 3. Projects (claude.ai ← Projects ← New project)
| المشروع | الوصف المقترح | الملفات |
|---|---|---|
| **HX3D Business** | مبيعات، محتوى انستقرام، عروض أسعار، CRM | `CLAUDE.md` + الكتالوج + قائمة الأسعار |
| **Work** | تصميم القطع، CAD، 3MF، إعدادات الطباعة | ملفات المنتجات وملاحظات الطابعة |
| **Personal** | شخصي | — |
لصق تعليمات المشروع لـ HX3D Business: محتوى `CLAUDE.md` من هذا المستودع.
