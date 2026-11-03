import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { customerStats } from '@/lib/admin';
import { isLocale } from '@/lib/i18n';
import { AD } from '@/lib/admin-strings';

export const dynamic = 'force-dynamic';
export default async function Overview({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = AD[lang];
  const s = await customerStats(prisma);
  return (
    <>
      <h1>{t.title}</h1>
      <div className="kpis">
        <div className="card kpi"><span>{t.kTotal}</span><b>{s.total.toLocaleString(t.date)}</b></div>
        <div className="card kpi"><span>{t.kRecent}</span><b>{s.recent.toLocaleString(t.date)}</b></div>
        <div className="card kpi muted"><span>{t.kSales}</span><b>{t.noData}</b></div>
        <div className="card kpi muted"><span>{t.kOrders}</span><b>{t.noData}</b></div>
      </div>
      <section className="card">
        <h2>{t.shopify}: <span className="warn">{t.notConnected}</span></h2>
        <p className="lead">{t.shopifyNote}</p>
        <p><Link href={`/${lang}/admin/orders`}>{t.orders} →</Link></p>
      </section>
    </>
  );
}
