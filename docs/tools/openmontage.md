# OpenMontage

**ما هو؟** نظام إنتاج فيديو مدفوع بوكلاء AI. تكتب طلبك (مثلاً: "فيديو شارح 60 ثانية عن…")، فيبحث الوكيل على الويب، ويولّد الصور، ويكتب السكربت ويعلّقه صوتياً، ويضيف الموسيقى والترجمات، ثم يرندر الفيديو النهائي. يعمل عبر Remotion لبناء الفيديو.

**المستودع:** https://github.com/calesthio/OpenMontage

## المتطلبات
- **Python 3.10+**
- **FFmpeg** — `brew install ffmpeg` (macOS) أو `sudo apt install ffmpeg` (Linux)
- **Node.js** — بالإصدار المحدد في ملف `.node-version` (حالياً 22.23.4 أو أحدث على خط 22.x)
- **مساعد برمجة AI** — Claude Code أو Cursor أو Copilot أو Windsurf أو Codex

## التثبيت والتشغيل
```bash
git clone https://github.com/calesthio/OpenMontage.git
cd OpenMontage
make setup
```
بدون `make` (macOS/Linux):
```bash
python3 -m venv .venv && source .venv/bin/activate
python -m pip install 'pip>=26.2.2'
python -m pip install -r requirements.txt
cd remotion-composer && npm install && cd ..
python -m pip install piper-tts
cp .env.example .env
```
ثم افتح المجلد في مساعد البرمجة واكتب طلبك، مثلاً:
> "Make a 60-second animated explainer about how neural networks learn"

## ملاحظات
- **المفاتيح:** عدّل ملف `.env` بالمفاتيح التي تحتاجها (مزودو الصور والصوت والموسيقى). كل مزود اختياري، لكن بعضها مدفوع، فراجع `.env.example` قبل التشغيل.
- **التكلفة:** توليد الصور والصوت عبر APIs مدفوعة يصرف رصيد على حسابك.
- **المراجعة:** النظام يطلب موافقتك على القرارات الإبداعية قبل الرندر النهائي.
- **تحديث pip:** إذا ظهر تحذير أمني عن شهادات CA، شغّل `pip install --upgrade 'pip>=26.2.2' 'certifi>=2026.10.19'` كما يذكر المشروع.
- **هذا المشروع منفصل تماماً عن موقع HX 3D (hx-os)**، ولا يُشغَّل من داخله.
