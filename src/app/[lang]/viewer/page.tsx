import Link from 'next/link';
import { notFound } from 'next/navigation';
import Logo from '@/components/Logo';
import ViewerLoader from '@/components/viewer/ViewerLoader';
import { SITE_HANDLE } from '@/lib/site';
import { isLocale } from '@/lib/i18n';
import { V } from '@/lib/viewer/strings';

export default async function ViewerPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = V[lang];
  return (
    <div className="wrap">
      <nav className="nav"><Link className="brandbar" href={`/${lang}`}><Logo /><span className="handle">{SITE_HANDLE}</span></Link>
        <Link className="lang" href={`/${lang === 'ar' ? 'en' : 'ar'}/viewer`}>{lang === 'ar' ? 'English' : 'العربية'}</Link></nav>
      <h1 style={{ margin: '8px 0' }}>{t.title}</h1><p className="lead">{t.lead}</p>
      <ViewerLoader t={t} lang={lang} />
    </div>
  );
}
