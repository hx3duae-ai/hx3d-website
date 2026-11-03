import Link from 'next/link';
import { notFound } from 'next/navigation';
import Logo from '@/components/Logo';
import Reveal from '@/components/Reveal';
import { SITE_HANDLE } from '@/lib/site';
import { dict, isLocale } from '@/lib/i18n';
import { A } from '@/lib/auth-strings';
import { PAGES } from '@/lib/pages';
import { CATEGORY_SLUGS } from '@/lib/categories';

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = dict[lang]; const other = lang === 'ar' ? 'en' : 'ar';
  return (
    <>
      <div className="wrap">
        <nav className="nav"><Link className="brandbar" href={`/${lang}`}><Logo /><span className="handle">{SITE_HANDLE}</span></Link><span className="navlinks"><Link className="lang" href={`/${lang}/account`}>{A[lang].navAccount}</Link><Link className="lang" href={`/${other}`}>{t.switch}</Link></span></nav>
        <section className="hero">
          <Logo size="lg" />
          <h1>{t.tagline}</h1>
          <p>{t.desc}</p>
          <div className="btns">
            <Link className="btn primary" href={`/${lang}/shop`}>{t.shop}</Link>
            <Link className="btn ghost" href={`/${lang}/viewer`}>{t.create}</Link>
          </div>
        </section>
        <div className="band" aria-label={t.band}>
          <div className="band-track">
            {Array.from({ length: 6 }, (_, i) => <span key={i}>{t.band}<i aria-hidden="true">✦</i></span>)}
          </div>
        </div>
        <h2>{t.catsTitle}</h2>
        <div className="cats">{t.cats.map((c, i) => <Reveal key={c} delay={i * 70}><Link className="cat" href={`/${lang}/shop/${CATEGORY_SLUGS[i]}`}>{c}</Link></Reveal>)}</div>
        <p className="note">{t.note}</p>
      </div>
      <nav className="foot-links" aria-label="footer">
        {(['about', 'contact', 'faq', 'tracking', 'cart', 'privacy', 'returns'] as const).map((k) => (
          <Link key={k} className="lang" href={`/${lang}/${k}`}>{PAGES[lang][k].title}</Link>
        ))}
      </nav>
      <footer className="foot">© {SITE_HANDLE} — {t.footer}</footer>
    </>
  );
}
