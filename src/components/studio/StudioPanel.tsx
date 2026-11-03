'use client';
import { useState } from 'react';
import * as THREE from 'three';
import type { ViewerEngine } from '@/lib/viewer/engine';
import { sliceMesh, primitive, combine, asRoot, type Primitive } from '@/lib/studio/edit';
import { exportModel, EXPORT_FORMATS, type ExportFormat } from '@/lib/studio/export';

export type StudioStrings = {
  title: string; note: string; cut: string; axis: string; at: string; keepLower: string; keepUpper: string; splitBoth: string;
  shape: string; kind: { box: string; sphere: string; cylinder: string }; size: string; mode: string; union: string; subtract: string; addShape: string;
  undo: string; exportT: string; exportBtn: string; photosT: string; photosBtn: string; noModel: string; failed: string;
};

export default function StudioPanel({ t, engine, geom, onApply, onUndo, canUndo }: {
  t: StudioStrings; engine: ViewerEngine | null; geom: THREE.BufferGeometry | null;
  onApply: (g: THREE.BufferGeometry[]) => void; onUndo: () => void; canUndo: boolean;
}) {
  const [axis, setAxis] = useState<'x' | 'y' | 'z'>('z');
  const [at, setAt] = useState(10);
  const [kind, setKind] = useState<Primitive>('box');
  const [size, setSize] = useState(20);
  const [mode, setMode] = useState<'union' | 'subtract'>('union');
  const [fmt, setFmt] = useState<ExportFormat>('stl');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fail = () => setMsg(t.failed);

  const centerOf = (g: THREE.BufferGeometry) => new THREE.Box3().setFromBufferAttribute(g.getAttribute('position') as THREE.BufferAttribute).getCenter(new THREE.Vector3());
  const doSlice = (keep: 'lower' | 'upper' | 'both') => {
    setMsg(null); if (!geom) return;
    try {
      // Panel uses print axes (X width, Y depth, Z height). The scene is Y-up: print Z = scene Y, print Y = -scene Z.
      const sceneAxis = axis === 'z' ? 'y' : axis === 'y' ? 'z' : 'x';
      const sceneAt = axis === 'y' ? -at : at;
      const { below, above } = sliceMesh(geom, sceneAxis, sceneAt);
      const lower = axis === 'y' ? above : below; const upper = axis === 'y' ? below : above;
      onApply(keep === 'both' ? [lower, upper] : [keep === 'lower' ? lower : upper]);
    } catch (e) { console.error('studio cut failed', e); fail(); }
  };
  const doShape = () => {
    setMsg(null); if (!geom) return;
    try {
      const c = centerOf(geom); const s = primitive(kind, size); s.translate(c.x, c.y, c.z);
      onApply([combine(geom, s, mode)]);
    } catch (e) { console.error('studio shape failed', e); fail(); }
  };
  const doExport = async () => {
    if (!geom) return; setBusy(true); setMsg(null);
    try {
      const blob = await exportModel(asRoot([geom]), fmt);
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `hx3d-model.${fmt}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch { fail(); } finally { setBusy(false); }
  };
  const doPhotos = () => {
    if (!engine || !geom) return;
    const views: [string, () => void][] = [
      ['front', () => engine.setView('front')], ['right', () => engine.setView('right')],
      ['top', () => engine.setView('top')], ['three-quarter', () => engine.resetView()],
    ];
    engine.setBackground('#f4f4f6'); engine.setGrid(false); engine.setBed(false); engine.setAutoRotate(false);
    setBusy(true);
    views.forEach(([name, set], i) => setTimeout(() => {
      set(); const url = engine.snapshot();
      const a = document.createElement('a'); a.href = url; a.download = `hx3d-${name}.png`; document.body.appendChild(a); a.click(); a.remove();
      if (i === views.length - 1) { engine.setBackground('#0b0b0f'); engine.setGrid(true); engine.setBed(true); setBusy(false); }
    }, i * 350));
  };

  return (
    <section className="pn studio">
      <h3>{t.title}</h3>
      <p className="nt">{t.note}</p>
      {!geom && <p className="nt">{t.noModel}</p>}

      <h4>{t.cut}</h4>
      <div className="row">
        <label>{t.axis}<select value={axis} onChange={(e) => setAxis(e.target.value as 'x' | 'y' | 'z')} disabled={!geom}><option value="x">X (عرض)</option><option value="y">Y (عمق)</option><option value="z">Z (ارتفاع)</option></select></label>
        <label>{t.at}<input type="number" value={at} onChange={(e) => setAt(+e.target.value)} disabled={!geom} /></label>
      </div>
      <div className="row">
        <button type="button" onClick={() => doSlice('lower')} disabled={!geom || busy}>{t.keepLower}</button>
        <button type="button" onClick={() => doSlice('upper')} disabled={!geom || busy}>{t.keepUpper}</button>
        <button type="button" onClick={() => doSlice('both')} disabled={!geom || busy}>{t.splitBoth}</button>
      </div>

      <h4>{t.shape}</h4>
      <div className="row">
        <label>{t.shape}<select value={kind} onChange={(e) => setKind(e.target.value as Primitive)} disabled={!geom}>
          <option value="box">{t.kind.box}</option><option value="sphere">{t.kind.sphere}</option><option value="cylinder">{t.kind.cylinder}</option></select></label>
        <label>{t.size}<input type="number" min={1} value={size} onChange={(e) => setSize(+e.target.value)} disabled={!geom} /></label>
        <label>{t.mode}<select value={mode} onChange={(e) => setMode(e.target.value as 'union' | 'subtract')} disabled={!geom}>
          <option value="union">{t.union}</option><option value="subtract">{t.subtract}</option></select></label>
      </div>
      <div className="row"><button type="button" onClick={doShape} disabled={!geom || busy}>{t.addShape}</button>
        <button type="button" onClick={onUndo} disabled={!canUndo}>{t.undo}</button></div>

      <h4>{t.exportT}</h4>
      <div className="row">
        <select value={fmt} onChange={(e) => setFmt(e.target.value as ExportFormat)} disabled={!geom} aria-label={t.exportT}>
          {EXPORT_FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}</select>
        <button type="button" onClick={doExport} disabled={!geom || busy}>{t.exportBtn}</button>
      </div>

      <h4>{t.photosT}</h4>
      <div className="row"><button type="button" onClick={doPhotos} disabled={!geom || busy}>{t.photosBtn}</button></div>

      {msg && <p className="er2" role="alert">{msg}</p>}
    </section>
  );
}
