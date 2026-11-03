import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { A } from '@/lib/auth-strings';
import AuthForm from '@/components/auth/AuthForm';
import { loginAction } from '../account/actions';

export default async function Login({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = A[lang];
  return (
    <div className="wrap page narrow">
      <h1>{t.loginTitle}</h1>
      <AuthForm action={loginAction.bind(null, lang)} submit={t.login} errors={t.errs} fields={[
        { name: 'email', label: t.email, type: 'email', required: true, autoComplete: 'email', ltr: true },
        { name: 'password', label: t.password, type: 'password', required: true, autoComplete: 'current-password', ltr: true },
      ]} />
      <p><Link href={`/${lang}/register`}>{t.toRegister}</Link></p>
    </div>
  );
}
