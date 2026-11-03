import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import Logo from '@/components/Logo';
import AuthForm from '@/components/auth/AuthForm';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { listAddresses } from '@/lib/accounts';
import { isLocale } from '@/lib/i18n';
import { SITE_HANDLE } from '@/lib/site';
import { A, EMIRATES, KINDS } from '@/lib/auth-strings';
import { addAddressAction, deleteAddressAction, logoutAction } from './actions';

export default async function Account({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = A[lang];
  const user = await currentUser(); // reads the session cookie; never trusts a client-supplied id
  if (!user) redirect(`/${lang}/login`);
  const addresses = await listAddresses(prisma, user.id);
  return (
    <div className="wrap page">
      <nav className="nav">
        <Link className="brandbar" href={`/${lang}`}><Logo /><span className="handle">{SITE_HANDLE}</span></Link>
        <form action={logoutAction.bind(null, lang)}><button className="lang" type="submit">{t.logout}</button></form>
      </nav>
      <h1>{t.hello}{user.name ? `، ${user.name}` : ''}</h1>
      <p className="lead ltr-inline">{user.email}</p>

      <section className="card">
        <h2>{t.addresses}</h2>
        {addresses.length === 0 ? <p className="lead">{t.noAddresses}</p> : (
          <ul className="addr">
            {addresses.map((a) => (
              <li key={a.id}>
                <div><strong>{a.fullName}</strong> · <span dir="ltr">{a.phone}</span> · {t.kinds[a.kind] ?? a.kind}</div>
                <div>{t.emirates[a.emirate] ?? a.emirate} — {a.area}، {a.street}، {a.building}{a.apartment ? ` — ${a.apartment}` : ''}</div>
                {a.notes && <div className="lead">{a.notes}</div>}
                <form action={deleteAddressAction.bind(null, lang)}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="lang" type="submit">{t.delete}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>{t.addAddress}</h2>
        <AuthForm action={addAddressAction.bind(null, lang)} submit={t.save} errors={t.errs} okText={t.addressSaved} fields={[
          { name: 'fullName', label: t.fullName, required: true },
          { name: 'phone', label: t.phone, type: 'tel', required: true, ltr: true },
          { name: 'emirate', label: t.emirate, required: true, options: EMIRATES.map((e) => ({ value: e, label: t.emirates[e] })) },
          { name: 'area', label: t.area, required: true },
          { name: 'street', label: t.street, required: true },
          { name: 'building', label: t.building, required: true },
          { name: 'apartment', label: t.apartment },
          { name: 'kind', label: t.kind, required: true, options: KINDS.map((k) => ({ value: k, label: t.kinds[k] })) },
          { name: 'mapUrl', label: t.mapUrl, type: 'url', ltr: true },
          { name: 'notes', label: t.notes },
        ]} />
      </section>
    </div>
  );
}
