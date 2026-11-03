import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { AD } from '@/lib/admin-strings';

export default async function Orders({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = AD[lang];
  // Orders come only from Shopify. Until that connection is verified, the list is empty by design.
  return (
    <section className="card">
      <h1>{t.ordersTitle}</h1>
      <p className="lead">{t.shopify}: <span className="warn">{t.notConnected}</span> — {t.shopifyNote}</p>
      <p className="empty">{t.noData}. {t.ordersEmpty}</p>
    </section>
  );
}
