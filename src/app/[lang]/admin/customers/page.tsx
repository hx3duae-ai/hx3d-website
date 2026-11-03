import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { listCustomers } from '@/lib/admin';
import { isLocale } from '@/lib/i18n';
import { AD } from '@/lib/admin-strings';

export const dynamic = 'force-dynamic';
export default async function Customers({ params, searchParams }: {
  params: Promise<{ lang: string }>; searchParams: Promise<{ q?: string }>;
}) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const { q = '' } = await searchParams;
  const t = AD[lang];
  const actor = await currentUser();
  if (!actor) redirect(`/${lang}/login`);
  const rows = await listCustomers(prisma, { q });
  await audit('admin.customers.view', { actorId: actor.id, entity: 'User' }); // personal data was read
  const fmt = (d: Date) => d.toLocaleDateString(t.date, { timeZone: 'Asia/Dubai', year: 'numeric', month: 'short', day: '2-digit' });
  return (
    <section className="card">
      <h1>{t.custTitle}</h1>
      <form method="get" className="search" role="search">
        <label htmlFor="q" className="sr">{t.search}</label>
        <input id="q" name="q" defaultValue={q} placeholder={t.search} maxLength={100} dir="auto" />
        <button className="btn primary" type="submit">{t.searchBtn}</button>
        {q && <Link className="lang" href={`/${lang}/admin/customers`}>{t.clear}</Link>}
      </form>
      <p className="lead">{t.count}: {rows.length}</p>
      {rows.length === 0 ? <p className="empty">{t.custEmpty}</p> : (
        <div className="tablewrap">
          <table>
            <thead><tr><th>{t.colName}</th><th>{t.colEmail}</th><th>{t.colPhone}</th><th>{t.colAddr}</th><th>{t.colJoined}</th><th>{t.colStatus}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name || <span className="lead">{t.unnamed}</span>}</td>
                  <td dir="ltr">{r.email}</td>
                  <td dir="ltr">{r.phone || '—'}</td>
                  <td>{r._count.addresses}</td>
                  <td>{fmt(r.createdAt)}</td>
                  <td>{r.disabledAt ? t.disabled : t.active}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
