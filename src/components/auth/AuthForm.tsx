'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import type { FormState } from '@/app/[lang]/account/actions';

export type Field = {
  name: string; label: string; type?: string; required?: boolean; autoComplete?: string;
  options?: { value: string; label: string }[]; ltr?: boolean;
};

export default function AuthForm({ action, fields, submit, errors, okText }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  fields: Field[]; submit: string; errors: Record<string, string>; okText?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  const ref = useRef<HTMLFormElement>(null);
  // React 19 resets a form after each action. Non-secret values live in state so a failed
  // attempt keeps what the user typed; passwords stay uncontrolled and are cleared on reset.
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => { if (state.ok) { ref.current?.reset(); setVals({}); } }, [state]);
  const set = (name: string) => (e: { target: { value: string } }) => setVals((v) => ({ ...v, [name]: e.target.value }));
  return (
    <form ref={ref} action={formAction} className="af">
      {fields.map((f) => (
        <label key={f.name} className="fld" htmlFor={f.name}>
          <span>{f.label}</span>
          {f.options ? (
            <select id={f.name} name={f.name} required={f.required} value={vals[f.name] ?? ''} onChange={set(f.name)}>
              {!f.required && <option value="" />}
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : f.type === 'password' ? (
            <input id={f.name} name={f.name} type="password" required={f.required} autoComplete={f.autoComplete} dir="ltr" />
          ) : (
            <input id={f.name} name={f.name} type={f.type ?? 'text'} required={f.required} autoComplete={f.autoComplete}
              dir={f.ltr ? 'ltr' : undefined} value={vals[f.name] ?? ''} onChange={set(f.name)} />
          )}
        </label>
      ))}
      {state.error && <p role="alert" className="er2">{errors[state.error] ?? errors.generic}</p>}
      {state.ok && okText && <p role="status" className="ok2">{okText}</p>}
      <button className="btn primary" type="submit" disabled={pending}>{submit}</button>
    </form>
  );
}
