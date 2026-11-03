import Link from 'next/link';
import { notFound } from 'next/navigation';
import Logo from '@/components/Logo';
import Reveal from '@/components/Reveal';
import { dict, isLocale } from '@/lib/i18n';

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = dict[lang]; const other = lang === 'ar' ? 'en' : 'ar';
  return (
    <>
      <div className="wrap">
        <nav className="nav"><Logo /><Link className="lang" href={`/${other}`}>{t.switch}</Link></nav>
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
      <footer className="foot">© HX 3D — {t.footer}</footer>
    </>
  );
}
