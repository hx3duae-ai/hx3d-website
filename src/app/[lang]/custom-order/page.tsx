import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { SH } from '@/lib/shop-strings';
import Logo from '@/components/Logo';
import { SITE_HANDLE } from '@/lib/site';

export default async function CustomOrder({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = SH[lang];
  return (
    <div className="wrap page narrow">
      <nav className="nav"><Link className="brandbar" href={`/${lang}`}><Logo /><span className="handle">{SITE_HANDLE}</span></Link>
        <span className="navlinks"><Link className="lang" href={`/${lang}`}>{t.home}</Link></span></nav>
      <h1>{t.customTitle}</h1><p className="lead">{t.customLead}</p>
      <section className="card steps">
        <div><h2>1 · {t.s1t}</h2><p className="lead">{t.s1}</p><Link className="btn ghost" href={`/${lang}/checker`}>{t.s1b}</Link></div>
        <div><h2>2 · {t.s2t}</h2><p className="lead">{t.s2}</p><Link className="btn ghost" href={`/${lang}/viewer`}>{t.s2b}</Link></div>
        <div><h2>3 · {t.s3t}</h2><p className="lead">{t.s3}</p><Link className="btn ghost" href={`/${lang}/login`}>{t.s3b}</Link></div>
      </section>
      <p className="nt">{t.note}</p>
    </div>
  );
}
