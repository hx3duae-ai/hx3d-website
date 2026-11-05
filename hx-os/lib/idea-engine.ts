// Offline content engine for HX 3D UAE. No network, no API key.
// Deterministic per (date, salt): the same day gives the same 3 ideas,
// "regenerate" bumps the salt. When ANTHROPIC_API_KEY is set, lib/claude.ts
// is used instead and this file is the fallback.
import type { Carousel, Idea, Pillar, ReelScript, Slide } from "./content-types";

// ---------- seeded RNG ----------
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];
function pickN<T>(r: () => number, xs: T[], n: number) {
  const copy = [...xs];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(r() * copy.length), 1)[0]);
  return out;
}

// ---------- Dubai calendar: occasions worth riding ----------
type Occasion = { name: string; from: string; to: string; pillars: Pillar[] }; // MM-DD
const OCCASIONS: Occasion[] = [
  { name: "رأس السنة", from: "12-15", to: "01-02", pillars: ["gifts", "products"] },
  { name: "مهرجان دبي للتسوق", from: "12-10", to: "01-25", pillars: ["products", "gifts"] },
  { name: "يوم العلم الإماراتي", from: "10-25", to: "11-03", pillars: ["gifts", "products"] },
  { name: "اليوم الوطني الإماراتي (عيد الاتحاد)", from: "11-04", to: "12-03", pillars: ["gifts", "products", "architecture"] },
  { name: "أسبوع دبي للتصميم", from: "10-25", to: "11-15", pillars: ["architecture", "products"] },
  { name: "معرض سيتي سكيب", from: "09-01", to: "10-10", pillars: ["architecture"] },
  { name: "جيتكس", from: "09-20", to: "10-20", pillars: ["products", "gifts"] },
  { name: "عيد الأم", from: "03-05", to: "03-21", pillars: ["gifts"] },
  { name: "العودة للمدارس", from: "08-10", to: "09-05", pillars: ["products"] },
  { name: "موسم المعارض والفعاليات", from: "01-26", to: "04-30", pillars: ["gifts", "architecture"] },
];

function inRange(mmdd: string, from: string, to: string) {
  return from <= to ? mmdd >= from && mmdd <= to : mmdd >= from || mmdd <= to;
}
export function occasionsFor(date: string) {
  const mmdd = date.slice(5);
  return OCCASIONS.filter((o) => inRange(mmdd, o.from, o.to));
}

// ---------- knowledge bank ----------
type Bank = {
  subjects: string[];
  audiences: string[];
  benefits: string[];
  pains: string[];
  visuals: string[];
};

const BANK: Record<Pillar, Bank> = {
  gifts: {
    subjects: [
      "مجسم شعار الشركة على قاعدة رخامية",
      "حامل بطاقات مكتبي بشعار العميل",
      "جوائز تكريم موظفين بتصميم خاص",
      "هدايا كبار الشخصيات (VIP) بالاسم",
      "ميداليات ودروع لفعاليات الشركات",
      "مجسم برج الشركة أو مقرها كتذكار",
      "منظم مكتبي مطبوع بلون الهوية",
      "هدايا رمضان والعيد للعملاء",
      "تذكارات المؤتمرات والمعارض",
      "صناديق هدايا مخصصة بقطع مطبوعة",
    ],
    audiences: ["مدراء الموارد البشرية", "فرق التسويق في الشركات", "منظمو الفعاليات", "مكاتب العلاقات العامة"],
    benefits: [
      "تصميم 100٪ بهوية شركتك — مو هدية جاهزة من الرف",
      "كميات من 10 إلى 1000 قطعة بنفس الجودة",
      "تسليم سريع داخل دبي خلال أيام",
      "ألوان متعددة بطبعة وحدة بدون دهان",
      "اسم كل موظف أو عميل على قطعته",
      "سعر أقل من الهدايا المستوردة المخصصة",
    ],
    pains: [
      "الهدايا التقليدية تنرمى بالدرج بعد أسبوع",
      "المستورد يحتاج شهر وحد أدنى كبير للكمية",
      "كل الشركات تهدي نفس القلم ونفس الكوب",
    ],
    visuals: [
      "لقطة قريبة للطابعة وهي ترسم أول طبقة من الشعار",
      "الهدية النهائية على مكتب تنفيذي بإضاءة دافئة",
      "صف من الجوائز المطبوعة جاهزة للتغليف",
      "يد تفتح صندوق الهدية ببطء",
    ],
  },
  architecture: {
    subjects: [
      "مجسم فيلا لمكتب مبيعات عقاري",
      "ماكيت برج سكني بمقياس 1:200",
      "مجسم مخطط مجتمع سكني كامل",
      "نموذج داخلي (Interior) لشقة نموذجية",
      "مجسم مشروع لعرض المستثمرين",
      "ماكيت تخرج لطلاب العمارة",
      "مجسم واجهة بتفاصيل دقيقة",
      "نموذج تضاريس وموقع (Site Model)",
      "مجسم بإضاءة LED داخلية",
      "مجسم مقطعي يكشف الطوابق",
    ],
    audiences: ["المطورين العقاريين", "مكاتب الهندسة المعمارية", "وسطاء العقار", "طلاب العمارة"],
    benefits: [
      "المشتري يفهم المشروع بثواني — أوضح من أي رندر",
      "دقة تفاصيل توصل إلى 0.1 ملم",
      "أسرع وأرخص من الماكيت اليدوي التقليدي",
      "تعديل التصميم وإعادة الطباعة بسهولة",
      "إضافة إضاءة ومقاطع داخلية",
      "يبيّن قوة المشروع في المعارض مثل سيتي سكيب",
    ],
    pains: [
      "الرندر على الشاشة ما يعطي إحساس الحجم الحقيقي",
      "الماكيت اليدوي ياخذ أسابيع ويكلف كثير",
      "العميل ما يقدر يتخيل المشروع على الخريطة",
    ],
    visuals: [
      "كاميرا تدور 360 حول المجسم على طاولة العرض",
      "تايم لابس لطباعة البرج طبقة طبقة",
      "يد تضع المجسم داخل صندوق عرض أكريليك",
      "إضاءة LED تشتغل داخل المجسم في الظلام",
    ],
  },
  products: {
    subjects: [
      "نموذج أولي (Prototype) لمنتج قبل التصنيع",
      "قطع غيار مخصصة ما تنباع بالسوق",
      "مجسمات شخصيات وألعاب ملونة",
      "حوامل ومنتجات للمتاجر والكافيهات",
      "إكسسوارات سيارات مخصصة",
      "منتج لمتجرك الإلكتروني بكميات صغيرة",
      "ستاند عرض منتجات للمحلات",
      "ديكور منزلي بتصميم عصري",
      "أغطية وحوامل للأجهزة الذكية",
      "تصميم من صورة إلى مجسم حقيقي",
    ],
    audiences: ["أصحاب المشاريع الصغيرة", "الستارت أب", "أصحاب المتاجر الإلكترونية", "المصممين والمهندسين"],
    benefits: [
      "من الفكرة إلى قطعة بيدك خلال 48 ساعة",
      "جرّب السوق بكمية صغيرة قبل ما تصنّع آلاف",
      "عدّل التصميم بدون تكلفة قوالب",
      "مواد قوية: PLA و PETG و TPU المرن",
      "طباعة متعددة الألوان بنظام AMS",
      "نصمم لك من الصفر لو ما عندك ملف",
    ],
    pains: [
      "القالب الصناعي يكلف آلاف قبل أول قطعة",
      "المصنع يطلب حد أدنى ضخم للكمية",
      "الفكرة تموت لأنك ما تقدر تجربها بيدك",
    ],
    visuals: [
      "انتقال سريع من رسمة على ورق إلى المنتج المطبوع",
      "لقطة ماكرو لطبقات الطباعة",
      "المنتج قيد الاستخدام في يد العميل",
      "مقارنة قبل/بعد: الملف على الشاشة ثم القطعة الحقيقية",
    ],
  },
};

const ANGLES: { title: (s: string) => string; hook: (s: string) => string; angle: string }[] = [
  { title: (s) => `كيف نصنع ${s} خطوة بخطوة`, hook: () => "من ملف على الكمبيوتر إلى قطعة بيدك… شوف كيف 👇", angle: "خلف الكواليس" },
  { title: (s) => `3 أخطاء شائعة عند طلب ${s}`, hook: () => "لا تطلب قبل ما تعرف هالـ3 أخطاء ❌", angle: "تعليمي" },
  { title: (s) => `${s}: قبل وبعد`, hook: () => "الفرق بين الفكرة والنتيجة النهائية 😮", angle: "قبل / بعد" },
  { title: (s) => `ليش الشركات في دبي تختار ${s}؟`, hook: () => "سر يعرفه أذكى فرق التسويق في دبي…", angle: "إقناع" },
  { title: (s) => `كم يكلف ${s}؟ الجواب الصريح`, hook: () => "السؤال اللي يوصلنا كل يوم: كم السعر؟ 💰", angle: "شفافية الأسعار" },
  { title: (s) => `طباعة 3D مقابل الطريقة التقليدية: ${s}`, hook: () => "نفس النتيجة… بنص الوقت؟ خلنا نقارن ⚖️", angle: "مقارنة" },
  { title: (s) => `فكرة اليوم: ${s}`, hook: () => "فكرة ممكن تغيّر طريقة تفكيرك 💡", angle: "إلهام" },
  { title: (s) => `تحدي: ${s} في 48 ساعة`, hook: () => "قدرنا نخلصها في يومين؟ تابع للآخر ⏱️", angle: "تحدي" },
];

const ANGLE_FOR_OCCASION = {
  title: (s: string, o: string) => `${s} بمناسبة ${o}`,
  hook: (o: string) => `${o} قرّب… وهذي أحلى فكرة تتميز فيها 🇦🇪`,
  angle: "مناسبة موسمية",
};

const BASE_TAGS = ["#HX3D", "#طباعة_ثلاثية_الأبعاد", "#3DPrinting", "#Dubai", "#دبي", "#UAE"];
const PILLAR_TAGS: Record<Pillar, string[]> = {
  gifts: ["#هدايا_شركات", "#CorporateGifts", "#هدايا_دبي", "#Branding"],
  architecture: ["#مجسمات_معمارية", "#ArchitecturalModel", "#DubaiRealEstate", "#عقارات_دبي"],
  products: ["#نموذج_أولي", "#Prototype", "#ProductDesign", "#مشاريع_صغيرة"],
};

export const BRAND = {
  name: "HX 3D UAE",
  handle: "@hx3d.uae",
  cta: "راسلنا على الواتساب أو الدايركت — التصميم والاستشارة مجاناً",
};

// ---------- generation ----------
export type DraftIdea = Pick<Idea, "pillar" | "title" | "angle" | "hook" | "audience" | "occasion">;

export function generateDailyIdeas(date: string, salt = 0): DraftIdea[] {
  const r = rng(`${date}#${salt}`);
  const occ = occasionsFor(date);
  const pillars: Pillar[] = ["gifts", "architecture", "products"];
  // At most one idea per day rides a current occasion (picked once, among pillars it fits).
  const fitting = pillars.filter((p) => occ.some((o) => o.pillars.includes(p)));
  const occasionPillar = fitting.length ? pick(r, fitting) : null;
  const angles = pickN(r, ANGLES, 3); // three different angles per day
  return pillars.map((pillar, i) => {
    const b = BANK[pillar];
    const subject = pick(r, b.subjects);
    const audience = pick(r, b.audiences);
    const o = occ.filter((x) => x.pillars.includes(pillar));
    if (o.length && pillar === occasionPillar) {
      const oc = pick(r, o);
      return {
        pillar,
        title: ANGLE_FOR_OCCASION.title(subject, oc.name),
        hook: ANGLE_FOR_OCCASION.hook(oc.name),
        angle: ANGLE_FOR_OCCASION.angle,
        audience,
        occasion: oc.name,
      };
    }
    const a = angles[i];
    return { pillar, title: a.title(subject), hook: a.hook(subject), angle: a.angle, audience };
  });
}

export function buildCarousel(idea: DraftIdea, seed: string): Carousel {
  const r = rng(`car#${seed}`);
  const b = BANK[idea.pillar];
  const benefits = pickN(r, b.benefits, 3);
  const pain = pick(r, b.pains);
  const slides: Slide[] = [
    { kicker: idea.angle, title: idea.hook, body: idea.title },
    { kicker: "المشكلة", title: pain, body: `وهذا اللي يواجهه أغلب ${idea.audience} في دبي.` },
    ...benefits.map((x, i) => ({ kicker: `الحل ${i + 1}`, title: x, body: benefitDetail(idea.pillar, i) })),
    {
      kicker: BRAND.name,
      title: "جاهز تحول فكرتك لقطعة حقيقية؟",
      body: `${BRAND.cta}\n${BRAND.handle}`,
    },
  ];
  const caption = [
    idea.hook,
    "",
    `${idea.title}.`,
    "",
    ...benefits.map((x) => `✅ ${x}`),
    "",
    `📍 دبي — توصيل لكل الإمارات`,
    `📩 ${BRAND.cta}`,
  ].join("\n");
  return { slides, caption, hashtags: [...BASE_TAGS, ...PILLAR_TAGS[idea.pillar]] };
}

function benefitDetail(p: Pillar, i: number) {
  const d: Record<Pillar, string[]> = {
    gifts: ["نصمم الهدية حول شعارك وألوانك.", "نفس الجودة من أول قطعة لآخر قطعة.", "نطبع ونغلف ونسلم لمكتبك."],
    architecture: ["من ملفات CAD أو Revit مباشرة.", "تفاصيل الواجهات والنوافذ والمساحات الخضراء.", "قاعدة وصندوق عرض جاهز للمعرض."],
    products: ["أرسل لنا فكرة أو صورة — نصمم الباقي.", "جرّب، عدّل، واطبع النسخة التالية.", "جاهز للبيع أو للعرض على المستثمرين."],
  };
  return d[p][i % 3];
}

export function buildReel(idea: DraftIdea, seed: string): ReelScript {
  const r = rng(`reel#${seed}`);
  const b = BANK[idea.pillar];
  const [v1, v2, v3] = pickN(r, b.visuals, 3);
  const [b1, b2] = pickN(r, b.benefits, 2);
  return {
    title: idea.title,
    scenes: [
      { seconds: 3, visual: v1, onScreen: idea.hook, voiceover: idea.hook.replace(/[👇❌😮💰⚖️💡👀🇦🇪⏱️]/gu, "").trim() },
      { seconds: 4, visual: "لقطة سريعة للمشكلة: منتج تقليدي ممل أو رندر على شاشة", onScreen: pick(r, b.pains), voiceover: "أغلب الناس يواجهون نفس المشكلة." },
      { seconds: 5, visual: v2, onScreen: b1, voiceover: `مع الطباعة ثلاثية الأبعاد: ${b1}.` },
      { seconds: 5, visual: v3, onScreen: b2, voiceover: `والأحلى؟ ${b2}.` },
      { seconds: 3, visual: "شعار HX 3D UAE مع رقم الواتساب", onScreen: "HX 3D UAE — دبي", voiceover: "HX 3D… حوّل فكرتك لشي حقيقي." },
    ],
    cta: BRAND.cta,
    music: pick(r, ["إيقاع إلكتروني هادئ 100bpm", "بيانو سينمائي مع بيس خفيف", "Lo-fi تقني"]),
  };
}
