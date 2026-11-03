'use client';
import { useState } from 'react';
export default function FormBox({ labels, cta, message, types }: { labels: string[]; cta: string; message: string; types?: string[] }) {
  const [sent, setSent] = useState(false);
  return (
    <form className="af" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
      {labels.map((l, i) => (
        <label className="fld" key={l} htmlFor={`f${i}`}><span>{l}</span>
          {i === labels.length - 1 && labels.length > 2 ? <textarea id={`f${i}`} rows={5} required /> :
            <input id={`f${i}`} type={types?.[i] ?? 'text'} required dir={types?.[i] === 'email' ? 'ltr' : undefined} />}
        </label>
      ))}
      <button className="btn primary" type="submit">{cta}</button>
      {sent && <p className="warn" role="status">{message}</p>}
    </form>
  );
}
