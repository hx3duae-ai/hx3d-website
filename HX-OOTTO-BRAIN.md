# OOTTO + Second Brain: سجل التركيب

> 5 نوفمبر 2026 · ✅ جاهز في الريبو · 👤 خطوة عليك (تسجيل دخول / حساب)

| البند | الحالة | المكان |
|---|---|---|
| Ootto MCP في المشروع | ✅ | `.mcp.json` |
| Ootto في claude.ai | 👤 | Settings ← Connectors |
| ربط انستا `hx3d.uae` | 👤 تسجيل دخول Meta | ootto.ai |
| 4 وكلاء OOTTO | ✅ صفحة HX OS جاهزة · 👤 التفعيل في OOTTO | `hx-os/app/instagram` |
| Virality skill (3.5M مشاهدة) | ✅ | `.claude/skills/virality` + `skills-upload/virality.zip` |
| Second Brain skills | ✅ `/second-brain` · `/second-brain-ingest` · `/second-brain-query` · `/second-brain-lint` | `.claude/skills/second-brain*` |
| Obsidian vault | ✅ | `hx-brain/` |
| استيراد ChatGPT + Claude | ✅ السكربت جاهز ومجرب · 👤 تنزل ملفات التصدير | `hx-brain/tools/import_chats.py` |

---

## 1. OOTTO

### الربط (👤 مرة وحدة، دقيقتين)
تسجيل الدخول لحساب انستا لازم يكون منك. ما أقدر أسويه بدالك، وسيرفر ootto.ai مقفول من الجلسة السحابية اللي أشتغل فيها.

**في claude.ai أو تطبيق الديسكتوب:**
1. **Settings ← Connectors ← Add custom connector**
2. الاسم: `Ootto` · الرابط: `https://mcp.ootto.ai/mcp`
3. **Connect** ← سجّل دخول OOTTO ← اربط Instagram Business **hx3d.uae** (لازم يكون Business أو Creator ومربوط بصفحة فيسبوك).

**في Claude Code:** مكتوب في `.mcp.json`. أول ما تفتح المشروع بيسألك توافق على `Ootto`. بعدها اكتب `/mcp` ← Ootto ← Authenticate.

### الوكلاء الأربعة
| الوكيل | في OOTTO | في HX OS (`/instagram`) |
|---|---|---|
| **Metrics Dashboard** | يسحب المشاهدات والحفظ والمشاركات والمتابعين | يعرضها ويربطها بالـ CRM |
| **Inbox AI** | يقرا الرسائل ويقترح الرد | دليل الردود بلهجتك |
| **Scheduler** | ينشر في الوقت المحدد | جدول 7 بوستات بالأسبوع |
| **Comment to DM** | كلمة في التعليق ← رسالة خاصة فيها الرابط أو الـ PDF | الكلمات المفتاحية مربوطة بالعروض |

👤 التفعيل من **ootto.ai ← Agents** بعد الربط. ولا بوست ينشر قبل موافقتك.

### Virality skill
مثبت في المشروع. جربه كذا:
> «اكتب لي 3 hooks لريل عن هدايا الشركات المطبوعة 3D»

يطلع لك 3 hooks تعدي اختبار من 8 نقاط، وسكربت سطر بسطر، وكلمة للتعليق، وكابشن. استخدمه مع `hx3d-brand-style` عشان يمشي على ألوانك وخطوطك.
👤 **عشان يشتغل في claude.ai بعد:** Settings ← Capabilities ← Skills ← ارفع `skills-upload/virality.zip`.

---

## 2. Second Brain (`hx-brain/`)

بنيته من **NicholasSpisak/second-brain** لأن فيه الأوامر اللي طلبتها بالضبط. وغيّرت `raw/` إلى `sources/` مثل ما طلبت.

```
hx-brain/
├── CLAUDE.md          ← القوانين اللي ينقرا كل سيشن
├── sources/           ← أنت تحط فيه كل ملفاتك (Claude ما يعدّل عليها)
│   ├── imports/       ← ملفات تصدير ChatGPT و Claude (.zip)
│   ├── chats/         ← محادثة وحدة في كل ملف (يتولد تلقائياً)
│   └── assets/        ← الصور والمرفقات
├── wiki/              ← Claude ينظمه كقاعدة معرفة مترابطة
│   ├── index.md · log.md
│   ├── summaries/ · entities/ · concepts/ · synthesis/
│   └── history/       ← المحادثات القديمة حسب الـ tag والمشروع
├── output/            ← تقارير وأجوبة تستاهل تنحفظ
└── tools/import_chats.py
```

### الأوامر
| الأمر | وش يسوي |
|---|---|
| `/second-brain` | حالة الـ vault: وش الجديد، كم صفحة، والخطوة الجاية |
| `/second-brain-ingest` | يستورد المحادثات وينظم الملفات الجديدة في `wiki/` |
| `/second-brain-query` | «وش أعرف عن تسعير هدايا الشركات؟» ويجاوب مع المصادر |
| `/second-brain-lint` | فحص: تناقضات، صفحات بدون روابط، معلومات قديمة |

### استيراد التاريخ القديم (👤 أنت تنزل الملفات)
1. **ChatGPT:** Settings ← Data controls ← **Export data**. يوصلك إيميل فيه zip.
2. **Claude:** Settings ← Privacy ← **Export data**. يوصلك إيميل فيه zip.
3. حط الملفين في `hx-brain/sources/imports/` وشغّل `/second-brain-ingest`، أو مباشرة:
   ```bash
   python3 hx-brain/tools/import_chats.py hx-brain/sources/imports/*
   ```
**وش يطلع لك:**
- ملف لكل محادثة فيه التاريخ والـ tags والمشروع. يتبع الفرع الأخير من المحادثة بس، فالردود اللي عدّلتها ما تتكرر.
- صفحات تجمع المحادثات حسب الـ tag (`#3d-printing`، `#instagram`، `#finance`…) وحسب المشروع (مشاريع Claude ومشاريع ChatGPT).
- تقدر تعيد تشغيله بأمان، ما يتكرر شي.

بعد الاستيراد، Claude ينظم المحتوى **حسب الموضوع** مو محادثة محادثة. مثلاً: «كل شي عن التسعير» يصير صفحة وحدة مرتبة مع مصادرها.

### الخصوصية
`hx-brain/sources/` و `hx-brain/wiki/history/` **مستثناة من git**. ملفاتك ومحادثاتك تبقى على جهازك وما ترفع للريبو. الصفحات المرتبة في `wiki/` تنحفظ عادي.

### فتحه في Obsidian (👤)
1. نزّل Obsidian من obsidian.md.
2. **Open folder as vault** ← اختر مجلد `hx-brain`.
3. اختياري: إضافة **Obsidian Web Clipper** للمتصفح، واحفظ المقالات في `sources/`.

### ليش ما استخدمت charlie947/ai-second-brain؟
قلت «أو»، فاخترت واحد. NicholasSpisak فيه `/second-brain` و `/second-brain-ingest` جاهزين وبنيته `sources` و `wiki` و `CLAUDE.md` نفس اللي تبيه.
