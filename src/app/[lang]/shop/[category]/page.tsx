import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale, dict } from '@/lib/i18n';
import { CATEGORY_SLUGS, isCategorySlug } from '@/lib/categories';
import { SH } from '@/lib/shop-strings';
import Logo from '@/components/Logo';
import { SITE_HANDLE } from '@/lib/site';

export const dynamicParams = false;
export const generateStaticParams = () => CATEGORY_SLUGS.map((category) => ({ category }));

export default async function Category({ params }: { params: Promise<{ lang: string; category: string }> }) {
  const { lang, category } = await params;
  if (!isLocale(lang) || !isCategorySlug(category)) notFound();
  const t = SH[lang]; const d = dict[lang];
  const name = d.cats[CATEGORY_SLUGS.indexOf(category)];
  return (
    <div className="wrap page">
      <nav className="nav"><Link className="brandbar" href={`/${lang}`}><Logo /><span className="handle">{SITE_HANDLE}</span></Link>
        <span className="navlinks"><Link className="lang" href={`/${lang}/shop`}>{t.back}</Link></span></nav>
      <h1>{name}</h1><p className="lead">{t.catLead}</p>
      <section className="card"><p className="empty">{t.noData}. {t.noProducts}</p></section>
      <p><Link className="btn ghost" href={`/${lang}/custom-order`}>{t.custom}</Link></p>
    </div>
  );
}
