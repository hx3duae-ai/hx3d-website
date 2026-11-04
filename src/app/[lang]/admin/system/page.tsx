import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { isLocale } from '@/lib/i18n';
import { pageGuard } from '@/lib/core/guard';
import { INTEGRATIONS, allStates, integrationKeys, killSwitchOn } from '@/lib/core/integrations';
import { secretStatus, vaultConfigured } from '@/lib/core/secrets';
import { CS } from '@/lib/core/strings';
import Forbidden from '@/components/core/Forbidden';
import { setModeAction, setEnabledAction, putSecretAction, deleteSecretAction, healthCheckAction } from './actions';

export const dynamic = 'force-dynamic';
const MODES = ['disabled', 'dry_run', 'test', 'live'] as const;

export default async function System({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = CS[lang]; const g = await pageGuard(lang, 'system.view'); if (!g) return <Forbidden text={t.forbidden} />;
  const manage = g.perms.has('integrations.manage'); const live = g.perms.has('integrations.live'); const secrets = g.perms.has('secrets.manage');
  const [states, kill] = await Promise.all([allStates(prisma), killSwitchOn(prisma)]);
  const allSecretNames = integrationKeys.flatMap((k) => INTEGRATIONS[k].secrets.map((s) => s.name));
  const ss = await secretStatus(prisma, allSecretNames);
  const vault = vaultConfigured();
  const fmt = (d: Date | null) => (d ? d.toLocaleString(t.date, { timeZone: 'Asia/Dubai' }) : t.never);
  return (
    <>
      <h1>{t.system}</h1>
      <p className="lead"><Link href={`/${lang}/admin/command`}>{t.cc}</Link> · <Link href={`/${lang}/admin/system/jobs`}>{t.jobs}</Link> · <Link href={`/${lang}/admin/system/notifications`}>{t.notes}</Link> · <Link href={`/${lang}/admin/system/audit`}>{t.audit}</Link> · <Link href={`/${lang}/admin/system/permissions`}>{t.perms}</Link></p>
      {kill && <p className="er2">{t.kill}: {t.killOn}</p>}
      {!vault && <p className="er2">{t.vaultMissing}</p>}
      <form action={healthCheckAction.bind(null, lang)}><button className="btn primary" type="submit">{t.check}</button></form>
      <p className="lead">{t.liveNeedsAdmin}</p>
      {integrationKeys.map((k) => {
        const d = INTEGRATIONS[k]; const s = states.find((x) => x.key === k)!;
        return (
          <section className="card" key={k}>
            <h2>{d.name[lang]} <span className="lead" dir="ltr">({k})</span></h2>
            <dl className="stats">
              <dt>{t.colStatus}</dt><dd className={s.status === 'ok' ? 'ok2' : s.status === 'error' ? 'er2' : 'warn'}>{t.status[s.status] ?? s.status}{s.statusDetail && <span className="lead" dir="auto"> — {s.statusDetail}</span>}</dd>
              <dt>{t.colMode}</dt><dd>{t.mode[s.mode]} · {s.enabled ? t.enabled : t.disabledL}</dd>
              <dt>{t.lastCheck}</dt><dd>{fmt(s.lastCheckAt)}</dd>
              {s.liveApprovedAt && (<><dt>{t.approvedBy}</dt><dd dir="ltr">{s.liveApprovedBy} · {fmt(s.liveApprovedAt)}</dd></>)}
            </dl>
            {manage && (
              <div className="core-form">
                <form action={setEnabledAction.bind(null, lang)}><input type="hidden" name="key" value={k} /><input type="hidden" name="enabled" value={s.enabled ? '0' : '1'} />
                  <button className="btn ghost" type="submit">{s.enabled ? t.disable : t.enable}</button></form>
                <form action={setModeAction.bind(null, lang)} className="core-form"><input type="hidden" name="key" value={k} />
                  <select name="mode" defaultValue={s.mode} aria-label={t.setMode}>{MODES.filter((m) => m !== 'live' || live).map((m) => <option key={m} value={m}>{t.mode[m]}</option>)}</select>
                  <button className="btn ghost" type="submit">{t.setMode}</button></form>
              </div>
            )}
            {d.secrets.length > 0 && (
              <>
                <h3>{t.secrets}</h3>
                <p className="lead">{t.secretHint}</p>
                <ul>{d.secrets.map((sd) => {
                  const st = ss.find((x) => x.name === sd.name)!; const env = !!(sd.env && process.env[sd.env]?.trim());
                  return (
                    <li key={sd.name}>
                      <b>{sd.label}</b> <span dir="ltr" className="lead">{sd.name}</span> — {st.configured ? <span className="ok2">{t.configured} ••••{st.fingerprint}</span> : env ? <span className="ok2">{t.fromEnv} ({sd.env})</span> : <span className="warn">{t.missing}</span>}
                      {sd.envOnly ? <span className="lead"> — {t.envOnly} <span dir="ltr">{sd.env}</span></span> : secrets && vault && (
                        <span className="core-form">
                          <form action={putSecretAction.bind(null, lang)} className="core-form"><input type="hidden" name="name" value={sd.name} />
                            <input type="password" name="value" autoComplete="off" required maxLength={8192} aria-label={sd.label} dir="ltr" />
                            <button className="btn ghost" type="submit">{t.save}</button></form>
                          {st.configured && <form action={deleteSecretAction.bind(null, lang)}><input type="hidden" name="name" value={sd.name} /><button className="btn ghost" type="submit">{t.remove}</button></form>}
                        </span>
                      )}
                    </li>
                  );
                })}</ul>
              </>
            )}
          </section>
        );
      })}
    </>
  );
}
