import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { PAGES } from '@/lib/pages';
import { Shell } from '@/components/pages/Simple';
export default async function P({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const c = PAGES[lang].about;
  return <Shell lang={lang}><h1>{c.title}</h1>{c.body.map((b) => <p className="lead" key={b}>{b}</p>)}</Shell>;
}
