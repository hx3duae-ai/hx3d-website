import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { isLocale } from '@/lib/i18n';
import { pageGuard } from '@/lib/core/guard';
import { PERMISSIONS, ADMIN_ONLY, effectivePermissions } from '@/lib/core/permissions';
import { CS } from '@/lib/core/strings';
import Forbidden from '@/components/core/Forbidden';
import { permissionAction } from '../actions';

export const dynamic = 'force-dynamic';
export default async function Permissions({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = CS[lang]; const g = await pageGuard(lang, 'permissions.manage'); if (!g) return <Forbidden text={t.forbidden} />;
  const staff = await prisma.user.findMany({ where: { role: 'STAFF', disabledAt: null }, select: { id: true, email: true, name: true, permissions: { select: { permission: true } } }, orderBy: { email: 'asc' } });
  const grantable = PERMISSIONS.filter((p) => !ADMIN_ONLY.includes(p));
  return (
    <section className="card">
      <h1>{t.perms}</h1>
      <p className="lead">{t.staffOnly}</p>
      {staff.length === 0 ? <p className="empty">{t.none}</p> : staff.map((u) => {
        const granted = new Set(u.permissions.map((p) => p.permission)); const defaults = effectivePermissions({ role: 'STAFF' });
        return (
          <div key={u.id} className="card">
            <h3 dir="ltr">{u.email}{u.name ? ` — ${u.name}` : ''}</h3>
            <ul>{grantable.map((p) => (
              <li key={p}><span dir="ltr">{p}</span> — {defaults.has(p) ? <span className="lead">{t.roleDefault}</span> : (
                <form action={permissionAction.bind(null, lang)} style={{ display: 'inline' }}>
                  <input type="hidden" name="userId" value={u.id} /><input type="hidden" name="permission" value={p} /><input type="hidden" name="op" value={granted.has(p) ? 'revoke' : 'grant'} />
                  <button className="btn ghost" type="submit">{granted.has(p) ? t.revoke : t.grant}</button></form>)}</li>
            ))}</ul>
          </div>
        );
      })}
    </section>
  );
}
