import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale, dict } from '@/lib/i18n';
import { CATEGORY_SLUGS } from '@/lib/categories';
import { SH } from '@/lib/shop-strings';
import Logo from '@/components/Logo';
import { SITE_HANDLE } from '@/lib/site';

export default async function Shop({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = SH[lang]; const d = dict[lang];
  return (
    <div className="wrap page">
      <nav className="nav"><Link className="brandbar" href={`/${lang}`}><Logo /><span className="handle">{SITE_HANDLE}</span></Link>
        <span className="navlinks"><Link className="lang" href={`/${lang}`}>{t.home}</Link></span></nav>
      <h1>{t.shopTitle}</h1><p className="lead">{t.shopLead}</p>
      <p className="warn">{t.shopify}: {t.notConnected}</p>
      <div className="cats">
        {CATEGORY_SLUGS.map((slug, i) => (
          <Link className="cat" key={slug} href={`/${lang}/shop/${slug}`}>{d.cats[i]}</Link>
        ))}
      </div>
    </div>
  );
}
