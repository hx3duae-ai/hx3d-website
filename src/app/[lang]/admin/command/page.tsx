import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { isLocale } from '@/lib/i18n';
import { pageGuard } from '@/lib/core/guard';
import { commandCenter } from '@/lib/core/command-center';
import { INTEGRATIONS, type IntegrationKey } from '@/lib/core/integrations';
import { CS } from '@/lib/core/strings';
import Forbidden from '@/components/core/Forbidden';
import { killSwitchAction } from '../system/actions';

export const dynamic = 'force-dynamic';
const cls = (s: string) => (s === 'ok' ? 'ok2' : s === 'error' ? 'er2' : 'warn');

export default async function CommandCenter({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = CS[lang]; const g = await pageGuard(lang, 'command.view'); if (!g) return <Forbidden text={t.forbidden} />;
  const c = await commandCenter(prisma);
  const n = (v: number) => v.toLocaleString(t.date);
  const canKill = g.perms.has('integrations.manage');
  return (
    <>
      <h1>{t.cc}</h1>
      <p className="lead">{t.ccLead}</p>

      {c.killSwitch && <section className="card"><p className="er2"><b>{t.kill}:</b> {t.killOn}</p></section>}

      <div className="kpis">
        <div className="card kpi"><span>{t.contacts}</span><b>{n(c.contacts.total)}</b><span>{t.new7}: {n(c.contacts.new7d)} · {t.registered}: {n(c.contacts.registeredCustomers)}</span></div>
        <div className="card kpi"><span>{t.files}</span><b>{n(c.files.sent30d)}</b><span>{t.filesTotal}: {n(c.files.sentTotal)} · {t.downloads}: {n(c.files.downloads)}</span></div>
        <div className={`card kpi${c.sales.connected ? '' : ' muted'}`}><span>{t.sales}</span>
          {c.sales.connected ? <><b>{n(c.sales.revenue30d)} AED</b><span>{n(c.sales.orders30d)} {t.orders}</span></> : <><b>{t.status[c.sales.reason] ?? c.sales.reason}</b><span>{t.salesOff}</span></>}</div>
        <div className={`card kpi${c.ads.connected ? '' : ' muted'}`}><span>{t.ads}</span>
          {c.ads.connected ? <b>{t.status.ok}</b> : <><b>{t.status[c.ads.reason] ?? c.ads.reason}</b><span>{t.adsOff}</span></>}</div>
        <div className="card kpi muted"><span>{t.najm}</span><b>{c.najm.built ? t.built : t.notBuilt}</b><span>{t.phase} 3 · LLM: {t.status[c.najm.integration?.status ?? 'unknown']}</span></div>
        <div className="card kpi"><span>{t.attention}</span><b className={c.notifications.action ? 'er2' : ''}>{n(c.notifications.action)}</b><span>{t.dead}: {n(c.jobs.dead)} · {t.rejected}: {n(c.rejectedWebhooks24h)}</span></div>
      </div>

      <section className="card">
        <h2>{t.attention}</h2>
        {c.attention.length === 0 ? <p className="empty">{t.attentionEmpty}</p> : (
          <ul>{c.attention.map((a) => <li key={a.id}><span className={a.level === 'error' ? 'er2' : 'warn'}>{a.title}</span>{a.count > 1 && <> ×{a.count}</>}</li>)}</ul>
        )}
        <p><Link href={`/${lang}/admin/system/notifications`}>{t.notes} →</Link> · <Link href={`/${lang}/admin/system/jobs`}>{t.jobs} →</Link></p>
      </section>

      <section className="card">
        <h2>{t.topVideos}</h2>
        {c.topVideos.length === 0 ? <p className="empty">{t.topVideosEmpty}</p> : (
          <ol>{c.topVideos.map((v) => <li key={v.videoId}><span dir="ltr">{v.videoId}</span> — {n(v.results)} {t.results}</li>)}</ol>
        )}
      </section>

      <section className="card">
        <h2>{t.integrations}</h2>
        <div className="tablewrap"><table>
          <thead><tr><th>{t.colIntegration}</th><th>{t.colMode}</th><th>{t.enabled}</th><th>{t.colStatus}</th><th>{t.lastCheck}</th></tr></thead>
          <tbody>{c.integrations.map((s) => (
            <tr key={s.key}><td>{INTEGRATIONS[s.key as IntegrationKey]?.name[lang] ?? s.key}</td><td>{t.mode[s.mode]}</td><td>{s.enabled ? t.enabled : t.disabledL}</td>
              <td className={cls(s.status)}>{t.status[s.status] ?? s.status}</td><td>{s.lastCheckAt ? s.lastCheckAt.toLocaleString(t.date, { timeZone: 'Asia/Dubai' }) : t.never}</td></tr>
          ))}</tbody>
        </table></div>
        <dl className="stats">
          <dt>{t.dbHealth}</dt><dd className={c.db.ok ? 'ok2' : 'er2'}>{c.db.ok ? `${t.status.ok} · ${c.db.latencyMs} ms` : t.status.error}</dd>
          <dt>{t.queue}</dt><dd>{t.queued}: {c.jobs.queued} · {t.running}: {c.jobs.running} · {t.failed}: {c.jobs.failed} · {t.dead}: {c.jobs.dead}</dd>
          <dt>{t.kill}</dt><dd>{c.killSwitch ? <span className="er2">{t.killOn}</span> : t.killOff}</dd>
        </dl>
        {canKill && (
          <form action={killSwitchAction.bind(null, lang)} style={{ marginTop: 16 }}>
            <input type="hidden" name="on" value={c.killSwitch ? '0' : '1'} />
            <button className={`btn ${c.killSwitch ? 'ghost' : 'primary'}`} type="submit">{c.killSwitch ? t.killRelease : t.killEngage}</button>
          </form>
        )}
        <p><Link href={`/${lang}/admin/system`}>{t.system} →</Link></p>
      </section>

      <section className="card">
        <h2>{t.sys.core}</h2>
        <ul>{c.systems.map((s) => <li key={s.key}>{t.sys[s.key]}: {s.built ? <span className="ok2">{t.built}</span> : <span className="warn">{t.notBuilt} ({t.phase} {'phase' in s ? s.phase : ''})</span>}</li>)}</ul>
        {c.contacts.byChannel.length > 0 && <p className="lead">{t.byChannel}: {c.contacts.byChannel.map((b) => `${b.channel} ${n(b.count)}`).join(' · ')}</p>}
      </section>
    </>
  );
}
