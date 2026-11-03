import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { A } from '@/lib/auth-strings';
import AuthForm from '@/components/auth/AuthForm';
import { registerAction } from '../account/actions';

export default async function Register({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (!isLocale(lang)) notFound();
  const t = A[lang];
  return (
    <div className="wrap page narrow">
      <h1>{t.registerTitle}</h1>
      <AuthForm action={registerAction.bind(null, lang)} submit={t.register} errors={t.errs} fields={[
        { name: 'name', label: t.name, required: true, autoComplete: 'name' },
        { name: 'email', label: t.email, type: 'email', required: true, autoComplete: 'email', ltr: true },
        { name: 'phone', label: t.phone, type: 'tel', autoComplete: 'tel', ltr: true },
        { name: 'password', label: t.password, type: 'password', required: true, autoComplete: 'new-password', ltr: true },
      ]} />
      <p><Link href={`/${lang}/login`}>{t.toLogin}</Link></p>
    </div>
  );
}
