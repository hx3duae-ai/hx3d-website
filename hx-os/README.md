# HX OS — نظام إدارة HX 3D UAE

تطبيق Next.js واحد يشتغل على جهازك، فيه 6 وحدات مربوطة ببعض. كل البيانات ملفات JSON في `data/`.

| # | الوحدة | الحالة |
|---|---|---|
| IG | **Instagram · OOTTO** — Metrics، Inbox AI، Scheduler (7 بوستات بالأسبوع)، Comment → DM | ✅ يعمل (OOTTO يتربط في Claude) |
| 1 | **Content OS** — 3 أفكار يومياً + كاروسيل + سكريبت ريل + رندر Remotion/FFmpeg | ✅ يعمل |
| 2 | **CRM** — العملاء، الحالات، Cal.com، المبيعات الشهرية | ✅ يعمل |
| 3 | App Builder | 🔜 |
| 4 | Video Studio (Veo) | 🔜 |
| 5 | Client Hunter | 🔜 |
| 6 | Second Brain (embeddings محلية) | 🔜 |

## التشغيل

```bash
cd hx-os
npm install
cp .env.example .env.local   # اختياري
npm run dev                  # http://localhost:3100
```

يحتاج Node 20 أو أحدث. FFmpeg اختياري (للضغط، والموسيقى، والصورة المصغرة). أول رندر ينزّل Chrome Headless لـ Remotion مرة واحدة فقط.

## Content OS
- أول ما تفتح الصفحة كل يوم تتولد 3 أفكار: هدايا شركات، مجسمات معمارية، ومنتجات. تتغير حسب مناسبات دبي (اليوم الوطني، أسبوع دبي للتصميم، سيتي سكيب، رمضان…).
- كل فكرة تتحول مباشرة إلى كاروسيل من 6 شرائح + كابشن + هاشتاقات + سكريبت ريل (اللقطة، النص على الشاشة، التعليق الصوتي).
- **المحرك**: بدون مفتاح يشتغل المحرك المحلي بدون إنترنت. مع `ANTHROPIC_API_KEY` يكتب Claude الأفكار، ولو تعطل يرجع للمحرك المحلي تلقائياً.
- **رندر**: زر «رندر الكل» يشغّل `scripts/render.mjs` في عملية منفصلة. Remotion يرسم الشرائح (PNG ‏1080×1350) والريل (MP4 ‏1080×1920)، وFFmpeg يصدّر بمواصفات HX (H.264 Main 4.1، ‏CRF 19، ‏faststart) ويسوي الصورة المصغرة، وبدون موسيقى حسب الهوية. الشكل يمشي على `hx3d-brand-style`. الملفات تنحفظ في `data/media/<id>/`.
- تعديل التصاميم: `npm run remotion:studio` ثم عدّل `remotion/Root.tsx`.
- اختياري: `npm run daily` من cron الساعة 7 الصبح.

## CRM
- جدول العملاء فيه: الاسم، الشركة، نوع الطلب، السعر بالدرهم، الحالة (ليد / قيد التنفيذ / تم التسليم)، والمصدر.
- **المبيعات الشهرية** = مجموع أسعار الطلبات المسلّمة حسب تاريخ التسليم (توقيت دبي). وتشوف بعد قيمة الطلبات قيد التنفيذ وعدد الليدز.
- **Cal.com** (نفس الحجز ما يتكرر، يتعرف عليه من الـ uid):
  - **سحب**: حط `CAL_API_KEY` واضغط «سحب الحجوزات الآن». يشتغل على localhost.
  - **Webhook**: `POST /api/webhooks/calcom` مع الأحداث Booking Created / Rescheduled / Cancelled. حط نفس الـ secret في `CAL_WEBHOOK_SECRET`. على localhost يحتاج نفق مثل `cloudflared tunnel --url http://localhost:3100`.
- زر «→ محتوى» على أي طلب مسلّم يسوي فكرة «قصة عميل» في Content OS، ونشرها يكون بعد موافقتك.

## Instagram · OOTTO
- OOTTO هو اللي ينفّذ على انستقرام من داخل Claude (تضيف connector مخصص بالرابط `https://mcp.ootto.ai/mcp`). HX OS يحفظ الخطة والقواعد وسكريبت المبيعات وتاريخ الأداء، وكل تبويب فيه برومبت جاهز تنسخه وتلصقه في Claude.
- `POST /api/instagram/leads`: يحوّل محادثة انستقرام لليد في الـ CRM. لو فتحت التطبيق للإنترنت، حط `HX_INBOUND_TOKEN`.
- الخطوات كاملة في `../HX-OS-V2.md`.

## الربط بين الوحدات
- `lib/db.ts`: مخزن واحد مشترك (ideas / clients / activity).
- كل وحدة تكتب في سجل النشاط `activity.json`، وهذا اللي بيفهرسه Second Brain لاحقاً.
