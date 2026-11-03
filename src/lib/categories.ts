// Same order as dict.cats in i18n.ts. Slugs are used in URLs.
export const CATEGORY_SLUGS = ['gifts', 'home-decor', 'personal-use', 'kids', 'custom-3d-printing', 'arabic-calligraphy', 'personalized-products'] as const;
export type CategorySlug = (typeof CATEGORY_SLUGS)[number];
export const isCategorySlug = (v: string): v is CategorySlug => (CATEGORY_SLUGS as readonly string[]).includes(v);
