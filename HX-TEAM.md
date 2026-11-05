# HX Team: البنية التحتية الكاملة لـ HX 3D UAE

> آخر تحديث: 5 نوفمبر 2026 · **الرموز:** ✅ جاهز في الريبو · 👤 خطوة عليك (حساب / فلوس / تسجيل دخول)

## الحالة باختصار

| الخطوة | البند | الحالة | الملف |
|---|---|---|---|
| 1 | 11 Plugin رسمية من Anthropic | ✅ مفعّلة في المشروع · 👤 تفعيلها في claude.ai | `.claude/settings.json` |
| 1 | ربط HubSpot و Notion و Slack | 👤 claude.ai ← Settings ← Connectors | |
| 2 | Chatwoot + Cal.diy + Cap + AppFlowy + Postiz | ✅ سكربت التركيب جاهز · 👤 سيرفر VPS | `infra/install.sh` |
| 2 | VoiceStudio | 👤 على جهازك (يحتاج GPU) | `infra/README.md` |
| 2 | Cal.diy مع CRM حق HX OS | ✅ | `hx-os/lib/calcom.ts` |
| 3 | 4 Agents يسلمون الشغل لبعض | ✅ | `.claude/agents/` |
| 3 | منظّم الفريق | ✅ | `.claude/skills/hx-team/` |

---

## الخطوة 1: الـ 11 Plugin

مكتوبة في `.claude/settings.json` من الـ marketplace الرسمي `anthropics/knowledge-work-plugins`. أول ما تفتح المشروع في Claude Code بيطلب منك تثق في الـ marketplace وبعدها تتثبت.

| Plugin | مين يستخدمه |
|---|---|
| sales | hx-sales |
| marketing | hx-marketing |
| finance | hx-finance |
| customer-support | hx-support |
| productivity · operations · design · data · enterprise-search · product-management · legal | أنت وكل الوكلاء |

👤 في **claude.ai** (مو المشروع): اضغط تثبيت في بطاقة الإضافات اللي أرسلتها لك، أو من Settings ← Plugins.
👤 **الربط**: claude.ai ← Settings ← Connectors ← HubSpot و Notion و Slack. الإضافات تلقاهم تلقائياً.

## الخطوة 2: البدائل المجانية

التفاصيل كاملة في **`infra/README.md`**. باختصار:
```bash
sudo bash infra/install.sh
```
| الأداة | بدل | المنفذ |
|---|---|---|
| Chatwoot | Intercom | 3000 |
| Cal.diy | Calendly | 3001 |
| Cap | Loom | 3002 |
| AppFlowy Cloud | Notion | 8080 |
| Postiz | OOTTO / Buffer | 4007 |
| VoiceStudio | ElevenLabs | جهازك |

## الخطوة 3: فريق الوكلاء

```
  عميل جديد
     │
     ▼
┌──────────┐   بطاقة    ┌─────────────┐   عرض    ┌───────────┐  موافقة  ┌───────────┐
│ hx-sales │ ─────────► │ hx-marketing│ ───────► │ hx-support│ ───────► │ hx-finance│ ──► ✅
└──────────┘            └─────────────┘          └───────────┘          └───────────┘
 Sales plugin            Marketing plugin         Chatwoot               Finance plugin
 HubSpot + CRM           OOTTO + brand style      Second Brain           فاتورة + VAT 5%
```

| الوكيل | وش يسوي | يكتب في |
|---|---|---|
| **hx-sales** | يقيّم العميل (A/B/C)، يحدد نوع الطلب، يسجله في الـ CRM | قسم Sales في البطاقة + `hx-os/data/clients.json` |
| **hx-marketing** | يسوي عرض بثلاث خيارات، يختار أعمال سابقة من بيانات OOTTO، ويكتب رسالة واتساب | قسم Marketing |
| **hx-support** | يتابع العميل في Chatwoot (ملاحظة خاصة تضغط عليها وترسل)، يدوّر في الـ Second Brain، يحدّث الحالة | قسم Support + Chatwoot |
| **hx-finance** | فاتورة إماراتية بضريبة 5%، قيد محاسبي، ويحدّث سعر العميل | `hx-team/invoices/HX-YYYY-NNN.md` |

**البطاقة المشتركة:** كل عميل له ملف واحد `hx-team/pipeline/<التاريخ>-<العميل>.md` (القالب في `_template.md`). الحقل `stage:` يقول دور مين الحين.

### طريقة الاستخدام
في Claude Code داخل المشروع:
```
/hx-team
عميل جديد من انستا: شركة الريم تبي 200 هدية شعار للموظفين قبل اليوم الوطني
```
أو بالعربي العادي: «شغل الفريق على هالعميل…»، «وين وصل عميل الريم؟»، «وضع الفريق».

### قواعد الأمان
- **ما يرسل أي وكيل رسالة للعميل بنفسه.** كل شي مسودة أو ملاحظة خاصة في Chatwoot، وأنت اللي ترسل.
- ما يحطون أسعار من عندهم. إذا السعر مو معروف ينكتب `TBD` ويوقف Finance ويسألك.
- ما ينحسب شي مدفوع إلا بتأكيدك.

### ملاحظات
- **OOTTO**: الوكيل يقرا بياناته من `hx-os/data/metrics.json` و `posts.json` اللي تسحبها صفحة Instagram في HX OS.
- **Second Brain**: لين ما تخلص صفحته (المرحلة 2 في `HX-OS-V2.md`)، وكيل الدعم يدوّر مباشرة في `hx-os/data/` (العملاء وسجل النشاط والأفكار).
- 👤 عبّ `hx-team/invoices/_company.md` مرة وحدة (TRN، IBAN، الرقم).
