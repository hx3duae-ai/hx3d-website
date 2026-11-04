'use client';
import { useActionState } from 'react';
import { resolveDraftAction } from './actions';

export default function ResolveForm({ lang, draftId, options, labels }: { lang: string; draftId: string; options: { id: string; label: string }[]; labels: Record<string, string> }) {
  const action = resolveDraftAction.bind(null, lang);
  const [state, formAction, pending] = useActionState(action, {});
  if (options.length === 0) return <p className="er2">{labels.none}</p>;
  return (
    <form action={formAction} className="linkform">
      <input type="hidden" name="draftId" value={draftId} />
      <label>{labels.pick}<select name="fileId" defaultValue={options[0].id}>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
      <button className="btn primary" type="submit" disabled={pending}>{labels.resolve}</button>
      {state.error && <p className="er2" role="alert">{labels.err}</p>}
      {state.ok && <p className="ok2" role="status">{labels.done}</p>}
    </form>
  );
}
