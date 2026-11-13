# HyperFrames

**ما هو؟** إطار مفتوح المصدر من HeyGen لإنتاج فيديو بكتابة HTML. تكتب الفيديو كصفحة HTML فيها حركات قابلة للتحكم بالتوقيت (seekable)، ثم ترندره. يأتي مع مهارات (skills) تعلّم مساعد البرمجة كيف ينتج فيديو صالح ويراجعه ويرندره.

**المستودع:** https://github.com/heygen-com/hyperframes

## التثبيت

### أ) كإضافة لـ Claude Code (الطريقة الموصى بها)
```bash
claude plugin marketplace add heygen-com/hyperframes
claude plugin install hyperframes@hyperframes
```
ثم استخدمه بالأمر: `/hyperframes:hyperframes`

### ب) كمهارات مستقلة (يعمل مع Claude Code و Codex و Cursor و Gemini CLI وغيرها)
```bash
npx skills add heygen-com/hyperframes
```
تظهر قائمة اختيار؛ مجموعة **Core Skills** تكفي معظم الاستخدامات. لتثبيت المجموعة الأساسية بدون قائمة:
```bash
npx hyperframes skills update
```

## التشغيل
داخل مجلد مشروع الفيديو:
```bash
npx hyperframes init
```
ثم اطلب من مساعد البرمجة، مثلاً:
> Using `/hyperframes`, create a 10-second product intro with a fade-in title, a background video, and subtle background music.

الدورة المعتادة: تخطيط الفيديو ← كتابة HTML ← إضافة الوسائط ← lint ← معاينة ← رندر. لأوامر المعاينة والرندر بالتفصيل شغّل `npx hyperframes --help`.

## ملاحظات
- **تثبيت محلي للمشروع:** شغّل أوامر `skills` من داخل مجلد مشروع الفيديو وليس من داخل مستودع HyperFrames نفسه، لتجنب الكتابة فوق ملفات.
- **المهارات الإضافية** (`/slideshow` و `/remotion-to-hyperframes` و `/figma`) تُثبَّت عند الطلب: `npx hyperframes skills update <name>`.
- **هذا المشروع منفصل تماماً عن موقع HX 3D (hx-os)**، ولا يُشغَّل من داخله.
