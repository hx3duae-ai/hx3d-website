import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { PAGES } from '@/lib/pages';
import { Shell } from '@/components/pages/Simple';
export default async function P({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const c = PAGES[lang].faq;
  return <Shell lang={lang}><h1>{c.title}</h1>
    {c.items.map(([q, a]) => <details key={q} className="card faq"><summary>{q}</summary><p className="lead">{a}</p></details>)}</Shell>;
}
