'use client';
import { useState } from 'react';
import { loadModel, ModelError } from '@/lib/viewer/load';
import { detectFormat, MAX_MODEL_BYTES, ACCEPT } from '@/lib/viewer/formats';
import { DEFAULT_PRINTER } from '@/lib/viewer/printers';
import { checkMesh, type Report } from '@/lib/checker/check';
import { extractMesh } from '@/lib/checker/extract';
import type { CK } from '@/lib/checker/strings';
type Strings = (typeof import('@/lib/checker/strings').CK)['ar'];

export default function CheckerTool({ t }: { t: Strings }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rep, setRep] = useState<Report | null>(null);
  const [name, setName] = useState('');

  async function run(file: File) {
    setBusy(true); setErr(null); setRep(null); setName(file.name);
    try {
      if (file.size > MAX_MODEL_BYTES) throw new Error('size');
      const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
      const d = detectFormat(file.name, head, file.size);
      if (d.kind !== 'model') throw new Error(d.kind === 'image' ? 'image' : 'unsupported');
      const model = await loadModel(await file.arrayBuffer(), d.format, file.name.replace(/\.[^.]+$/, ''));
      setRep(checkMesh(extractMesh(model.root), DEFAULT_PRINTER));
    } catch (e) {
      const code = e instanceof ModelError ? e.code : (e as Error).message;
      setErr(({ size: 'big', image: 'image', unsupported: 'unsupported', 'too-many-triangles': 'tri', 'points-only': 'points', empty: 'empty' } as Record<string, string>)[code] ?? 'corrupt');
    } finally { setBusy(false); }
  }
  const E = (k: string) => (t.codes as Record<string, { t: string; e: string; f: string }>)[k];
  const errMsg: Record<string, string> = {
    big: 'حجم الملف أكبر من الحد المسموح (50 ميغابايت).', image: 'هذا ملف صورة وليس مجسماً، ولا يُفحص كنموذج ثلاثي الأبعاد.',
    unsupported: 'صيغة غير مدعومة أو الملف لا يطابق امتداده.', tri: 'عدد المثلثات أكبر من الحد المسموح (2 مليون).',
    points: 'الملف سحابة نقاط بلا أسطح، ولا يمكن فحصه كمجسم.', empty: 'لا يحتوي الملف على مجسم قابل للفحص.', corrupt: 'الملف تالف أو لا يمكن قراءته.',
  };
  const verdictClass = rep?.verdict === 'ready' ? 'ok' : rep?.verdict === 'warnings' ? 'wip' : 'bad';
  const fmt = (n: number) => n.toLocaleString('en-US');

  return (
    <div className="vw">
      <label className="drop">
        <input id="ck-file" type="file" accept={ACCEPT} disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f); e.target.value = ''; }} />
        <b>{t.drop}</b><span>{t.dropSub}</span>
      </label>
      {busy && <p className="lead" role="status">{t.busy}</p>}
      {err && <p className="er2" role="alert">{errMsg[err]}</p>}

      {rep && (
        <section className="card ckrep" aria-live="polite">
          <div className="ckhead">
            <span className="file">{name}</span>
            <span className={`verdict ${verdictClass}`}>{t.verdict[rep.verdict]}</span>
          </div>
          <p className="lead">{t.verdictNote[rep.verdict]}</p>
          <dl className="stats">
            <dt>{t.stats.tris}</dt><dd>{fmt(rep.triangles)}</dd>
            <dt>{t.stats.verts}</dt><dd>{fmt(rep.vertices)}</dd>
            <dt>{t.stats.parts}</dt><dd>{rep.parts}</dd>
            <dt>{t.stats.size}</dt><dd dir="ltr">{rep.size ? `${rep.size.x.toFixed(1)} × ${rep.size.y.toFixed(1)} × ${rep.size.z.toFixed(1)} ${t.mm}` : t.na}</dd>
            <dt>{t.stats.closed}</dt><dd>{rep.closed ? t.yes : t.no}</dd>
            <dt>{t.stats.holes}</dt><dd>{rep.holes}</dd>
            <dt>{t.stats.volume}</dt><dd dir="ltr">{rep.volumeMm3 != null ? `${fmt(Math.round(rep.volumeMm3 / 1000))} cm³` : t.na}</dd>
          </dl>
          <h3>{t.issues}</h3>
          {rep.issues.length === 0 ? <p className="lead">{t.none}</p> : (
            <ul className="issues">
              {rep.issues.map((i) => (
                <li key={i.code} className={i.severity}>
                  <div className="ih"><span className={`sev ${i.severity}`}>{t.severity[i.severity]}</span><b>{E(i.code)?.t ?? i.code}</b>{i.count != null && <span className="cnt">{t.count}: {fmt(i.count)}</span>}</div>
                  <p>{E(i.code)?.e}</p>
                  <p className="fix">{E(i.code)?.f}</p>
                </li>
              ))}
            </ul>
          )}
          <h3>{t.checked}</h3>
          <ul className="plain">{rep.checked.map((c) => <li key={c}>{c}</li>)}</ul>
          <h3>{t.notChecked}</h3>
          <ul className="plain muted">{rep.notChecked.map((c) => <li key={c}>{c}</li>)}</ul>
          <p className="nt">{t.unit}</p>
        </section>
      )}
    </div>
  );
}
