import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { PAGES } from '@/lib/pages';
import { Shell } from '@/components/pages/Simple';
export default async function P({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const c = PAGES[lang].cart;
  return <Shell lang={lang}><h1>{c.title}</h1><section className="card"><p className="empty">{c.empty}</p></section><p className="lead">{c.note}</p></Shell>;
}
