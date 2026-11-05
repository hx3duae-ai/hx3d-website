# البدائل المجانية لـ HX 3D UAE

كل الأدوات مفتوحة المصدر وتشتغل على سيرفر واحد تملكه أنت. ما فيه اشتراكات شهرية، بس تدفع السيرفر.

| الأداة | بدل | الرابط بعد التركيب | المصدر الرسمي |
|---|---|---|---|
| **Chatwoot** | Intercom | `http://SERVER:3000` | github.com/chatwoot/chatwoot |
| **Cal.diy** | Calendly | `http://SERVER:3001` | github.com/calcom/cal.diy |
| **Cap** | Loom | `http://SERVER:3002` + تطبيق Cap على جهازك | github.com/CapSoftware/Cap |
| **AppFlowy Cloud** | Notion | `http://SERVER:8080` + تطبيق AppFlowy | github.com/AppFlowy-IO/AppFlowy-Cloud |
| **VoiceStudio** | ElevenLabs | على جهازك أنت (مو السيرفر) | github.com/debpalash/VoiceStudio |

## 1. السيرفر (👤 أنت)
- VPS بنظام **Ubuntu 22.04 أو أحدث**، **4 vCPU / 8GB RAM / 80GB** على الأقل (الأدوات الأربع مع بعض). Hetzner CX32 أو Contabo تكفي، تقريباً 25 إلى 40 درهم بالشهر.
- افتح المنافذ: 3000، 3001، 3002، 8080، 9010.

## 2. التركيب (أمر واحد)
```bash
git clone <this repo> hx3d && cd hx3d
sudo bash infra/install.sh            # الأربع كلها
sudo bash infra/install.sh chatwoot   # أو وحدة وحدة: chatwoot | caldiy | cap | appflowy
```
- السكربت يركب Docker إذا مو موجود، وينزل كل أداة من الريبو الرسمي حقها في `/opt/hx3d/<tool>`، ويولّد كلمات سر عشوائية ويحفظها في `/opt/hx3d/secrets.env`.
- غيّر المنافذ عشان ما تتعارض الأدوات مع بعض (Chatwoot و Cal.diy و Cap كلهم يبون 3000 أصلاً).
- يحتاج Docker Compose **2.24.4 أو أحدث**.

## 3. الربط
### Chatwoot: صندوق واحد للواتساب والانستا والإيميل
1. افتح `http://SERVER:3000` وسوّ حساب الأدمن.
2. **Settings → Inboxes → Add Inbox**:
   - **WhatsApp**: يحتاج WhatsApp Business Cloud API من Meta (رقم بزنس + Meta Business Manager).
   - **Instagram**: يحتاج حساب Instagram Business مربوط بصفحة فيسبوك.
   - **Email**: ربط Gmail بـ IMAP/SMTP (`hx3d.uae@gmail.com` + App Password).
3. **Profile → Access Token**: انسخه في `infra/.env` (انسخ `infra/.env.example`). وكيل الدعم يقراه.

### Cal.diy مع CRM حق HX OS
1. افتح `http://SERVER:3001` وكمّل الإعداد.
2. **Settings → Developer → Webhooks**: حط `https://<HX OS>/api/webhooks/calcom` وحط نفس الـ secret في `CAL_WEBHOOK_SECRET` في `hx-os/.env.local`. كل حجز يدخل الـ CRM كـ «ليد» على طول.

### Cap
- نزّل تطبيق Cap (Mac/Windows) من cap.so ← **Settings → Self-hosted** ← حط `http://SERVER:3002`.

### AppFlowy
- نزّل تطبيق AppFlowy ← **Settings → Cloud → Self-hosted** ← حط `http://SERVER:8080`. بيانات دخول الأدمن في `secrets.env`.

### VoiceStudio: تعليق صوتي عربي
- يشتغل **على جهازك**. يبي كرت شاشة NVIDIA (8GB VRAM أو أكثر) أو Mac M-series. السيرفر الرخيص ما يقدر عليه.
- التركيب من صفحة الإصدارات في github.com/debpalash/VoiceStudio.
- **بدائل جاهزة عندك من الحين**: Munsit (مربوط في Claude، لهجات خليجية) والـ skill `gulf-voices-free` (مجاني، edge-tts).

## 4. HTTPS (لاحقاً)
عشان واتساب وانستا يحتاجون رابط `https`، حط دومين فرعي لكل أداة (`inbox.hx3d.ae`، `book.hx3d.ae`…) وراء Caddy أو Nginx Proxy Manager.
