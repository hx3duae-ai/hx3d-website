'use client';
import { useActionState, useState } from 'react';
import { approveDraftAction, type ApproveState } from './actions';

export default function ApproveForm({ lang, draftId, labels }: { lang: string; draftId: string; labels: Record<string, string> }) {
  const action = approveDraftAction.bind(null, lang);
  const [state, formAction, pending] = useActionState(action, {} as ApproveState);
  const [copied, setCopied] = useState(false);
  return (
    <form action={formAction} className="linkform">
      <input type="hidden" name="draftId" value={draftId} />
      {!state.url && <button className="btn primary" type="submit" disabled={pending}>{labels.approve}</button>}
      {state.error && <p className="er2" role="alert">{labels.err}</p>}
      {state.url && (
        <div className="linkbox" role="status">
          <p className="warn">{labels.once}</p>
          <code dir="ltr">{state.url}</code>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(state.url!).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? labels.copied : labels.copy}</button>
        </div>
      )}
    </form>
  );
}
