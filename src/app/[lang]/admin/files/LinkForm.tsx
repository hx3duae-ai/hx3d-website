'use client';
import { useActionState, useState } from 'react';
import { createLinkAction, type LinkState } from './actions';

export default function LinkForm({ lang, fileId, labels }: { lang: string; fileId: string; labels: Record<string, string> }) {
  const action = createLinkAction.bind(null, lang);
  const [state, formAction, pending] = useActionState(action, {} as LinkState);
  const [copied, setCopied] = useState(false);
  return (
    <form action={formAction} className="linkform">
      <input type="hidden" name="fileId" value={fileId} />
      <label>{labels.recipient}<input name="recipient" maxLength={120} placeholder={labels.recipientPh} /></label>
      <label>{labels.ttl}<select name="ttlHours" defaultValue="48"><option value="24">24</option><option value="48">48</option><option value="168">168</option></select></label>
      <label>{labels.max}<select name="maxDownloads" defaultValue="1"><option value="1">1</option><option value="3">3</option><option value="5">5</option></select></label>
      <button className="btn primary" type="submit" disabled={pending}>{labels.create}</button>
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
