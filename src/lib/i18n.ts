export const locales = ['ar', 'en'] as const;
export type Locale = (typeof locales)[number];
export const isLocale = (v: string): v is Locale => (locales as readonly string[]).includes(v);
export const dirOf = (l: Locale) => (l === 'ar' ? 'rtl' : 'ltr');

export const dict = {
  ar: {
    brand: 'HX 3D', tagline: 'حوّل أفكارك إلى مجسمات ثلاثية الأبعاد',
    desc: 'طباعة ثلاثية الأبعاد مخصصة، هدايا، ديكور، وخط عربي — صُنعت لك في الإمارات.',
    shop: 'تسوّق الآن', create: 'صمّم مجسمك', switch: 'English', currency: 'درهم',
    catsTitle: 'الأقسام',
    cats: ['هدايا', 'ديكور المنزل', 'استخدام شخصي', 'أطفال', 'طباعة 3D مخصصة', 'الخط العربي', 'منتجات مخصصة'],
    note: 'المتجر قيد الإعداد: لم يتم ربط Shopify بعد، ولا تُعرض أي منتجات حتى يكتمل الربط.',
    footer: 'جميع الحقوق محفوظة',
    band: 'طباعة ثلاثية الأبعاد في الإمارات',
  },
  en: {
    brand: 'HX 3D', tagline: 'Turn Your Ideas Into 3D',
    desc: 'Custom 3D printing, gifts, home décor and Arabic calligraphy — made for you in the UAE.',
    shop: 'Shop Now', create: 'Create Your 3D Design', switch: 'العربية', currency: 'AED',
    catsTitle: 'Categories',
    cats: ['Gifts', 'Home Décor', 'Personal Use', 'Kids', 'Custom 3D Printing', 'Arabic Calligraphy', 'Personalized Products'],
    note: 'The store is being set up: Shopify is not connected yet, so no products are shown until the connection succeeds.',
    footer: 'All rights reserved',
    band: '3D Printing in the UAE',
  },
} as const;
