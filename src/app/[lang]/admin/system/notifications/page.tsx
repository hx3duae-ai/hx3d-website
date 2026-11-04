import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { isLocale } from '@/lib/i18n';
import { pageGuard } from '@/lib/core/guard';
import { listRecent } from '@/lib/core/notifications';
import { CS } from '@/lib/core/strings';
import Forbidden from '@/components/core/Forbidden';
import { resolveNotificationAction } from '../actions';

export const dynamic = 'force-dynamic';
export default async function Notifications({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = CS[lang]; const g = await pageGuard(lang, 'system.view'); if (!g) return <Forbidden text={t.forbidden} />;
  const manage = g.perms.has('notifications.manage'); const rows = await listRecent(prisma);
  return (
    <section className="card">
      <h1>{t.notes}</h1>
      {rows.length === 0 ? <p className="empty">{t.none}</p> : (
        <div className="tablewrap"><table>
          <thead><tr><th>{t.level}</th><th>{t.source}</th><th>{t.entity}</th><th>{t.count}</th><th>{t.when}</th><th /></tr></thead>
          <tbody>{rows.map((n) => (
            <tr key={n.id}><td className={n.level === 'error' ? 'er2' : n.level === 'warning' ? 'warn' : ''}>{n.level}{n.actionRequired && ' ⚑'}</td><td dir="ltr">{n.source}</td>
              <td dir="auto">{n.title}{n.body && <div className="lead" dir="auto">{n.body}</div>}</td><td>{n.count}</td><td>{n.updatedAt.toLocaleString(t.date, { timeZone: 'Asia/Dubai' })}</td>
              <td>{n.resolvedAt ? <span className="ok2">{t.resolve}</span> : manage && <form action={resolveNotificationAction.bind(null, lang)}><input type="hidden" name="id" value={n.id} /><button className="btn ghost" type="submit">{t.resolve}</button></form>}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  );
}
