import Link from 'next/link';
import Logo from '@/components/Logo';
import { SITE_HANDLE } from '@/lib/site';
export function Shell({ lang, children }: { lang: 'ar' | 'en'; children: React.ReactNode }) {
  return (
    <div className="wrap page narrow">
      <nav className="nav"><Link className="brandbar" href={`/${lang}`}><Logo /><span className="handle">{SITE_HANDLE}</span></Link>
        <span className="navlinks"><Link className="lang" href={`/${lang === 'ar' ? 'en' : 'ar'}`}>{lang === 'ar' ? 'English' : 'العربية'}</Link></span></nav>
      {children}
    </div>
  );
}
