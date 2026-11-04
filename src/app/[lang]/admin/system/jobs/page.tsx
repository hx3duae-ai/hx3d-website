import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { isLocale } from '@/lib/i18n';
import { pageGuard } from '@/lib/core/guard';
import { queueStats } from '@/lib/core/jobs';
import { CS } from '@/lib/core/strings';
import Forbidden from '@/components/core/Forbidden';
import { retryJobAction, cancelJobAction } from '../actions';

export const dynamic = 'force-dynamic';
export default async function Jobs({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = CS[lang]; const g = await pageGuard(lang, 'system.view'); if (!g) return <Forbidden text={t.forbidden} />;
  const manage = g.perms.has('jobs.manage');
  const [s, rows] = await Promise.all([queueStats(prisma), prisma.job.findMany({ where: { status: { in: ['dead', 'failed', 'running', 'queued'] } }, orderBy: { updatedAt: 'desc' }, take: 100,
    select: { id: true, type: true, status: true, attempts: true, maxAttempts: true, lastError: true, runAt: true, updatedAt: true } })]);
  return (
    <section className="card">
      <h1>{t.jobs}</h1>
      <div className="kpis">{(['queued', 'running', 'failed', 'dead', 'succeeded'] as const).map((k) => <div className="card kpi" key={k}><span>{t[k]}</span><b>{s[k]}</b></div>)}</div>
      {rows.length === 0 ? <p className="empty">{t.none}</p> : (
        <div className="tablewrap"><table>
          <thead><tr><th>{t.type}</th><th>{t.colStatus}</th><th>{t.attempts}</th><th>{t.error}</th><th>{t.when}</th><th /></tr></thead>
          <tbody>{rows.map((j) => (
            <tr key={j.id}><td dir="ltr">{j.type}</td><td className={j.status === 'dead' ? 'er2' : ''}>{t[j.status as 'dead']}</td><td>{j.attempts}/{j.maxAttempts}</td>
              <td dir="ltr" className="lead">{j.lastError ?? '—'}</td><td>{j.updatedAt.toLocaleString(t.date, { timeZone: 'Asia/Dubai' })}</td>
              <td>{manage && j.status === 'dead' && <form action={retryJobAction.bind(null, lang)}><input type="hidden" name="id" value={j.id} /><button className="btn ghost" type="submit">{t.retry}</button></form>}
                {manage && j.status !== 'running' && <form action={cancelJobAction.bind(null, lang)}><input type="hidden" name="id" value={j.id} /><button className="btn ghost" type="submit">{t.cancel}</button></form>}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  );
}
