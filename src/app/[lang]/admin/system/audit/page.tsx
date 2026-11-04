import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { isLocale } from '@/lib/i18n';
import { pageGuard } from '@/lib/core/guard';
import { CS } from '@/lib/core/strings';
import Forbidden from '@/components/core/Forbidden';

export const dynamic = 'force-dynamic';
export default async function Audit({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = CS[lang]; const g = await pageGuard(lang, 'audit.view'); if (!g) return <Forbidden text={t.forbidden} />;
  const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { actor: { select: { email: true } } } });
  return (
    <section className="card">
      <h1>{t.audit}</h1>
      <div className="tablewrap"><table>
        <thead><tr><th>{t.when}</th><th>{t.actor}</th><th>{t.action}</th><th>{t.entity}</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}><td>{r.createdAt.toLocaleString(t.date, { timeZone: 'Asia/Dubai' })}</td><td dir="ltr">{r.actor?.email ?? '—'}</td><td dir="ltr">{r.action}</td>
            <td dir="ltr">{[r.entity, r.entityId].filter(Boolean).join(' · ')}{r.meta ? <span className="lead"> {JSON.stringify(r.meta)}</span> : null}</td></tr>
        ))}</tbody>
      </table></div>
    </section>
  );
}
