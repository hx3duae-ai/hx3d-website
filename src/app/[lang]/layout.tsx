import '../globals.css';
import { notFound } from 'next/navigation';
import { SITE_HANDLE, SITE_URL } from '@/lib/site';
import { dirOf, isLocale, locales, dict } from '@/lib/i18n';
export const generateStaticParams = () => locales.map((lang) => ({ lang }));
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) return {};
  return { metadataBase: new URL(SITE_URL), title: `${SITE_HANDLE} — ${dict[lang].tagline}`, description: dict[lang].desc, openGraph: { siteName: SITE_HANDLE, title: SITE_HANDLE, description: dict[lang].desc } };
}
export default async function L({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  return (<html lang={lang} dir={dirOf(lang)}><body>{children}</body></html>);
}
