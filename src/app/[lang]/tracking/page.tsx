import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { PAGES } from '@/lib/pages';
import { Shell } from '@/components/pages/Simple';
import FormBox from '@/components/pages/FormBox';
export default async function P({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const c = PAGES[lang].tracking;
  return <Shell lang={lang}><h1>{c.title}</h1><p className="lead">{c.body[0]}</p><p className="warn">{c.body[1]}</p>
    <FormBox labels={c.labels} cta={c.cta} message={c.notConnected} types={['text', 'email']} /></Shell>;
}
