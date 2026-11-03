import Link from 'next/link';
import { notFound } from 'next/navigation';
import Logo from '@/components/Logo';
import Reveal from '@/components/Reveal';
import { SITE_HANDLE } from '@/lib/site';
import { dict, isLocale } from '@/lib/i18n';
import { A } from '@/lib/auth-strings';

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = dict[lang]; const other = lang === 'ar' ? 'en' : 'ar';
  return (
    <>
      <div className="wrap">
        <nav className="nav"><span className="brandbar"><Logo /><span className="handle">{SITE_HANDLE}</span></span><span className="navlinks"><Link className="lang" href={`/${lang}/account`}>{A[lang].navAccount}</Link><Link className="lang" href={`/${other}`}>{t.switch}</Link></span></nav>
        <section className="hero">
          <Logo size="lg" />
          <h1>{t.tagline}</h1>
          <p>{t.desc}</p>
          <div className="btns">
            <Link className="btn primary" href={`/${lang}`}>{t.shop}</Link>
            <Link className="btn ghost" href={`/${lang}`}>{t.create}</Link>
          </div>
        </section>
        <h2>{t.catsTitle}</h2>
        <div className="cats">{t.cats.map((c, i) => <Reveal key={c} delay={i * 70}><div className="cat">{c}</div></Reveal>)}</div>
        <p className="note">{t.note}</p>
      </div>
      <footer className="foot">© {SITE_HANDLE} — {t.footer}</footer>
    </>
  );
}
