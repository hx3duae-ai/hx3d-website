import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import Logo from '@/components/Logo';
import { currentUser } from '@/lib/auth';
import { hasRole } from '@/lib/rbac';
import { isLocale } from '@/lib/i18n';
import { SITE_HANDLE } from '@/lib/site';
import { AD } from '@/lib/admin-strings';

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = AD[lang];
  const user = await currentUser(); // authorisation is checked on the server for every admin page
  if (!user) redirect(`/${lang}/login`);
  if (!hasRole(user.role, 'STAFF')) {
    return <div className="wrap page narrow"><h1>{t.title}</h1><p className="er2">{t.forbidden}</p></div>;
  }
  return (
    <div className="wrap page">
      <nav className="nav">
        <Link className="brandbar" href={`/${lang}/admin`}><Logo /><span className="handle">{SITE_HANDLE}</span></Link>
        <span className="navlinks">
          <Link className="lang" href={`/${lang}/admin`}>{t.home}</Link>
          <Link className="lang" href={`/${lang}/admin/orders`}>{t.orders}</Link>
          <Link className="lang" href={`/${lang}/admin/customers`}>{t.customers}</Link>
          <Link className="lang" href={`/${lang}/admin/command`}>Command Center</Link>
          <Link className="lang" href={`/${lang}/admin/system`}>{lang === 'ar' ? 'النظام' : 'System'}</Link>
        </span>
      </nav>
      {children}
    </div>
  );
}
