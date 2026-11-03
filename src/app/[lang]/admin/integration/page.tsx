import { notFound } from 'next/navigation';
import { connectionStatus } from '@/lib/shopify/status';
import { isLocale } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
const L = {
  ar: { title: 'حالة ربط Shopify', read: 'وضع القراءة فقط: لا تُنشأ منتجات ولا طلبات ولا تُعدّل الأسعار أو المخزون.', state: 'الحالة',
    not_configured: 'غير مُعدّ', auth_failed: 'فشل المصادقة (تحقق من بيانات التطبيق)', unreachable: 'المتجر غير متاح حالياً', connected: 'متصل',
    missing: 'الإعدادات الناقصة في ملف .env المحلي', store: 'المتجر', scopes: 'الصلاحيات (قراءة فقط)', secrets: 'لا تُعرض أي أسرار أو توكنات هنا.' },
  en: { title: 'Shopify connection status', read: 'Read-only mode: no products, orders, prices or stock are changed.', state: 'Status',
    not_configured: 'Not configured', auth_failed: 'Authentication failed (check the app credentials)', unreachable: 'Store currently unreachable', connected: 'Connected',
    missing: 'Missing settings in your local .env', store: 'Store', scopes: 'Scopes (read-only)', secrets: 'No secrets or tokens are shown here.' },
};
export default async function Integration({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = L[lang];
  const s = await connectionStatus();
  return (
    <section className="card">
      <h1>{t.title}</h1>
      <p className="warn">{t.read}</p>
      <dl className="stats">
        <dt>{t.state}</dt><dd>{t[s.state]}</dd>
        {s.state === 'not_configured' && (<><dt>{t.missing}</dt><dd dir="ltr">{s.missing.join(', ')}</dd></>)}
        {s.state === 'connected' && (<><dt>{t.store}</dt><dd dir="ltr">{s.shopName} ({s.domain})</dd><dt>{t.scopes}</dt><dd dir="ltr">{s.scopes.join(', ')}</dd></>)}
      </dl>
      <p className="lead">{t.secrets}</p>
    </section>
  );
}
