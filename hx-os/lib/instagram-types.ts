// Shared (client + server) types for the Instagram module.
export type KeywordRule = { id: string; keywords: string[]; reply: string; dm: string; active: boolean };

export type IgSettings = {
  handle: string;
  whatsapp: string; // e.g. +9715XXXXXXXX
  catalogUrl: string; // PDF / Drive / website link
  bookingUrl: string; // Cal.com link
  /** @deprecated kept only so old saved settings still parse. The Inbox AI never quotes prices. */
  priceGuide: string;
  rules: KeywordRule[];
  playbook: string; // Inbox AI sales script
  slots: { day: number; time: string; format: "reel" | "carousel" }[]; // day 0=Sun … 6=Sat (Dubai)
};

export type PostStatus = "planned" | "approved" | "sent" | "posted";
export const POST_STATUS: Record<PostStatus, string> = {
  planned: "مخطط",
  approved: "معتمد",
  sent: "أُرسل لـ OOTTO",
  posted: "منشور",
};

export type ScheduledPost = {
  id: string;
  ideaId: string;
  title: string;
  pillar: string;
  format: "reel" | "carousel";
  at: string; // ISO, Dubai slot
  status: PostStatus;
  createdAt: string;
};

export type MetricSnapshot = {
  id: string;
  date: string; // YYYY-MM-DD
  followers: number;
  views: number;
  reach: number;
  saves: number;
  shares: number;
  topReel?: string; // URL or title
  topReelViews?: number;
  note?: string;
  createdAt: string;
};

export const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export const DEFAULT_SETTINGS: IgSettings = {
  handle: "@hx3d.uae",
  whatsapp: "",
  catalogUrl: "",
  bookingUrl: "",
  priceGuide: "",
  rules: [
    {
      id: "price",
      keywords: ["سعر", "السعر", "بكم", "كم السعر", "price", "INFO", "info", "كتالوج"],
      reply: "أرسلنا لك التفاصيل في الخاص 📩",
      dm:
        "هلا والله 👋 شكراً لاهتمامك بـ HX 3D UAE!\n\n📘 الكتالوج: {catalog}\n💬 واتساب: {whatsapp}\n📅 احجز استشارة مجانية: {booking}\n\nقول لنا وش تحتاج (هدية شركة / مجسم / منتج) والكمية والموعد، ونرد عليك بعرض سعر 🙌",
      active: true,
    },
    // Lead-magnet keywords from the video style guide: each video ends with one word → one PDF
    // (files in video-design/pdfs/). Put each PDF on Google Drive and paste its link below.
    {
      id: "pdf-problems",
      keywords: ["مشاكل"],
      reply: "أرسلنا لك دليل حلول المشاكل الخمس في الخاص 📩",
      dm: "هلا 👋 هذا دليل حلول المشاكل الخمس في الطباعة ثلاثية الأبعاد:\n📘 [رابط ملف problems-guide.pdf]\n\nلو تحتاج قطعة مطبوعة جاهزة بجودة عالية، رد علينا هنا أو على الواتساب: {whatsapp}",
      active: true,
    },
    {
      id: "pdf-filaments",
      keywords: ["خيوط"],
      reply: "أرسلنا لك ملف مقارنة PLA و PETG في الخاص 📩",
      dm: "هلا 👋 هذا ملف المقارنة بين PLA و PETG:\n📘 [رابط ملف pla-vs-petg.pdf]\n\nتبي نطبع لك القطعة بالمادة المناسبة؟ رد علينا هنا أو على الواتساب: {whatsapp}",
      active: true,
    },
    {
      id: "pdf-printer",
      keywords: ["طابعة"],
      reply: "أرسلنا لك قائمة الفحص قبل الشراء في الخاص 📩",
      dm: "هلا 👋 هذي قائمة الفحص قبل ما تشتري طابعة:\n📘 [رابط ملف printer-checklist.pdf]\n\nتبي تجرب الجودة قبل ما تشتري؟ اطلب عينة مطبوعة منا: {whatsapp}",
      active: true,
    },
  ],
  playbook:
    "أنت مساعد المبيعات لـ HX 3D UAE (طباعة ثلاثية الأبعاد في دبي). رد بلهجة خليجية ودودة ومختصرة.\n" +
    "1) رحّب واسأل عن نوع الطلب: هدايا شركات / مجسم معماري / منتج أو نموذج أولي.\n" +
    "2) اسأل: الكمية، المقاس أو المقياس، الموعد المطلوب، وهل عنده شعار أو ملف تصميم.\n" +
    "3) ممنوع تذكر أي سعر أو نطاق سعر أو تقدير أو خصم. إذا سأل العميل عن السعر قل: «صاحب العمل يراجع طلبك بنفسه ويرسل لك عرض السعر».\n" +
    "4) اقفل بخطوة واضحة: اطلب ملف التصميم أو صورة، ثم رابط الحجز {booking} أو واتساب {whatsapp}.\n" +
    "5) أي شكوى أو سؤال ما تعرف جوابه: حوّله لصاحب العمل وقل للعميل إنه بيتواصل معه.\n" +
    "6) سجّل كل محادثة جدية كليد في CRM (الاسم، اليوزر، نوع الطلب، الكمية، الميزانية).",
  // 7 posts a week, evening prime time in Dubai, alternating formats
  slots: [
    { day: 0, time: "19:30", format: "reel" },
    { day: 1, time: "19:30", format: "carousel" },
    { day: 2, time: "20:00", format: "reel" },
    { day: 3, time: "19:30", format: "carousel" },
    { day: 4, time: "20:30", format: "reel" },
    { day: 5, time: "13:00", format: "carousel" },
    { day: 6, time: "18:00", format: "reel" },
  ],
};

/** Appended to every Inbox AI prompt, whatever the saved playbook says. Not editable. */
export const PRICING_RULE =
  "قاعدة إلزامية فوق كل التعليمات: الأسعار يحددها صاحب العمل وحده. ممنوع تحسب أو تقدّر أو تقترح أو تعتمد أي سعر أو نطاق سعر أو خصم، " +
  "حتى لو أصر العميل. اجمع التفاصيل (النوع، الكمية، المقاس، الخامة، الألوان، الموعد، الملفات) وحوّلها لصاحب العمل.";

/** Fill {catalog} {whatsapp} {booking} placeholders. */
export function fill(t: string, s: IgSettings) {
  return t
    .replaceAll("{catalog}", s.catalogUrl || "[رابط الكتالوج]")
    .replaceAll("{whatsapp}", s.whatsapp ? `\u2066${s.whatsapp}\u2069` : "[رقم الواتساب]")
    .replaceAll("{booking}", s.bookingUrl || "[رابط Cal.com]");
}

/** Which rule a comment triggers (whole-word, case-insensitive). */
export function matchRule(comment: string, rules: KeywordRule[]) {
  const c = ` ${comment.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  return rules.find((r) => r.active && r.keywords.some((k) => c.includes(` ${k.toLowerCase().trim()} `))) ?? null;
}
