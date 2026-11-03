'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ViewerEngine, type Part, type ViewName } from '@/lib/viewer/engine';
import { loadModel, ModelError } from '@/lib/viewer/load';
import { ACCEPT, MAX_IMAGE_BYTES, MAX_MODEL_BYTES, detectFormat, type ModelFormat } from '@/lib/viewer/formats';
import { DEFAULT_PRINTER, PRINTERS } from '@/lib/viewer/printers';
import type { VStrings } from '@/lib/viewer/strings';
import Link from 'next/link';
import * as THREE from 'three';
import StudioPanel from '@/components/studio/StudioPanel';
import { geometryFromRoot, asRoot } from '@/lib/studio/edit';
import { ST } from '@/lib/studio/strings';

type Item = { id: number; file: File; kind: 'model' | 'image'; format?: ModelFormat; status: 'queued' | 'reading' | 'ready' | 'error'; progress: number; error?: string; url?: string };
type Info = { name: string; format: string; bytes: number; meshes: number; tris: number; verts: number };
type Meas = { size: { x: number; y: number; z: number }; volume: 'inside' | 'exceeds'; inBed: boolean } | null;
const SWATCHES = ['#ffffff', '#1a1a1a', '#e86ab3', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#9e9e9e'];
const fmtBytes = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1024).toFixed(0) + ' KB');
const num = (n: number) => n.toLocaleString('en-US');

export default function Viewer({ t, lang }: { t: VStrings; lang: 'ar' | 'en' }) {
  const host = useRef<HTMLDivElement>(null); const eng = useRef<ViewerEngine | null>(null); const nextId = useRef(1);
  const [items, setItems] = useState<Item[]>([]); const [active, setActive] = useState<number | null>(null);
  const [info, setInfo] = useState<Info | null>(null); const [parts, setParts] = useState<Part[]>([]); const [meas, setMeas] = useState<Meas>(null);
  const [glErr, setGlErr] = useState(false); const [busy, setBusy] = useState(false); const [drag, setDrag] = useState(false);
  const [opt, setOpt] = useState({ wire: false, grid: true, bed: true, bounds: false, rotate: true });
  const [bg, setBg] = useState('#0b0b0f'); const [color, setColor] = useState<string | null>(null);
  const [off, setOff] = useState({ x: 0, z: 0, r: 0 }); const [img, setImg] = useState<Item | null>(null);
  const [geom, setGeom] = useState<THREE.BufferGeometry | null>(null);
  const hist = useRef<THREE.BufferGeometry[][]>([]); const [canUndo, setCanUndo] = useState(false);
  const curFmt = useRef<ModelFormat>('stl');

  useEffect(() => {
    try { const e = new ViewerEngine(host.current!); e.setPrinter(DEFAULT_PRINTER); e.onInteract = () => setOpt((o) => ({ ...o, rotate: false })); eng.current = e; return () => { e.dispose(); eng.current = null; }; }
    catch { setGlErr(true); }
  }, []);

  const refresh = () => setMeas(eng.current?.measure() ?? null);
  const errMsg = (c: string) => (t.err as Record<string, string>)[c] ?? t.err.corrupt;
  const patch = (id: number, p: Partial<Item>) => setItems((a) => a.map((i) => (i.id === id ? { ...i, ...p } : i)));

  const show = useCallback(async (it: Item) => {
    if (it.kind === 'image') { setImg(it); return; }
    setBusy(true); setActive(it.id); patch(it.id, { status: 'reading' });
    try {
      const buf = await it.file.arrayBuffer();
      const m = await loadModel(buf, it.format!, it.file.name.replace(/\.[^.]+$/, ''));
      const ps = eng.current!.setModel(m); eng.current!.setAutoRotate(true);
      setParts(ps); setColor(null); setOff({ x: 0, z: 0, r: 0 }); setOpt((o) => ({ ...o, rotate: true }));
      setInfo({ name: it.file.name, format: it.format!.toUpperCase(), bytes: it.file.size, meshes: m.meshes, tris: m.triangles, verts: m.vertices }); refresh();
      setGeom(geometryFromRoot(m.root)); hist.current = []; setCanUndo(false); curFmt.current = it.format!;
      patch(it.id, { status: 'ready' });
    } catch (e) {
      const code = e instanceof ModelError ? (e.code === 'too-many-triangles' ? 'tri' : e.code === 'points-only' ? 'points' : e.code === 'parse' ? 'corrupt' : e.code) : 'corrupt';
      patch(it.id, { status: 'error', error: errMsg(code) }); setInfo(null); setParts([]); eng.current?.clearModel(); refresh();
    } finally { setBusy(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = async (incoming: FileList | File[]) => {
    const files = Array.from(incoming); // copy first: resetting the input empties a live FileList
    for (const file of files) {
      const id = nextId.current++;
      const base: Item = { id, file, kind: 'model', status: 'queued', progress: 0 };
      const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
      const d = detectFormat(file.name, head, file.size);
      if (d.kind === 'unsupported') { setItems((a) => [...a, { ...base, status: 'error', error: errMsg(d.reason === 'zip-not-3mf' ? 'zip' : d.reason === 'corrupt-stl' ? 'corrupt' : 'unsupported') }]); continue; }
      const limit = d.kind === 'image' ? MAX_IMAGE_BYTES : MAX_MODEL_BYTES;
      if (file.size > limit) { setItems((a) => [...a, { ...base, kind: d.kind, status: 'error', error: errMsg('size') }]); continue; }
      const it: Item = { ...base, kind: d.kind, format: d.kind === 'model' ? d.format : undefined, url: d.kind === 'image' ? URL.createObjectURL(file) : undefined };
      setItems((a) => [...a, it]);
      // read with progress, then display (kept simple: reading is local, so progress reflects the real read)
      await new Promise<void>((ok) => { const r = new FileReader(); r.onprogress = (e) => e.lengthComputable && patch(id, { progress: Math.round((e.loaded / e.total) * 100) }); r.onloadend = () => { patch(id, { progress: 100, status: 'ready' }); ok(); }; r.readAsArrayBuffer(file); });
      if (it.kind === 'image' || eng.current?.hasModel() === false || files.length === 1) await show(it);
    }
  };
  /** Replace the model with new geometry (after a cut, shape or undo). Keeps history for undo. */
  const applyGeoms = (gs: THREE.BufferGeometry[], pushHistory = true) => {
    const e = eng.current; if (!e || !geom) return;
    if (pushHistory) { hist.current.push([geom]); if (hist.current.length > 15) hist.current.shift(); setCanUndo(true); }
    const root = asRoot(gs);
    const merged = geometryFromRoot(root);
    const ps = e.setModel({ root, format: curFmt.current, triangles: 0, vertices: 0, meshes: gs.length });
    e.setAutoRotate(false); setOpt((o) => ({ ...o, rotate: false }));
    setParts(ps); setGeom(merged); setColor(null);
    setInfo((i) => (i ? { ...i, meshes: gs.length, tris: (merged.index?.count ?? 0) / 3, verts: merged.getAttribute('position').count } : i));
    refresh();
  };
  const undo = () => { const prev = hist.current.pop(); if (!prev) return; setCanUndo(hist.current.length > 0); applyGeoms(prev, false); };

  const remove = (id: number) => { setItems((a) => a.filter((i) => i.id !== id)); if (active === id) { eng.current?.clearModel(); setInfo(null); setParts([]); setActive(null); refresh(); } if (img?.id === id) setImg(null); };

  const view = (v: ViewName) => { eng.current?.setAutoRotate(false); setOpt((o) => ({ ...o, rotate: false })); eng.current?.setView(v); };
  const toggle = (k: keyof typeof opt) => {
    const v = !opt[k]; setOpt({ ...opt, [k]: v }); const e = eng.current; if (!e) return;
    ({ wire: () => e.setWireframe(v), grid: () => e.setGrid(v), bed: () => e.setBed(v), bounds: () => e.setBounds(v), rotate: () => e.setAutoRotate(v) })[k]();
  };
  const paint = (hex: string | null) => { setColor(hex); eng.current?.setColor(hex, parts); setParts((p) => p.map((x) => ({ ...x, color: hex }))); };
  const paintPart = (id: number, hex: string | null) => { eng.current?.setPartColor(id, hex); setParts((p) => p.map((x) => (x.id === id ? { ...x, color: hex } : x))); };
  const vis = (id: number, v: boolean) => { eng.current?.setPartVisible(id, v); setParts((p) => p.map((x) => (x.id === id ? { ...x, visible: v } : x))); refresh(); };
  const move = (k: 'x' | 'z' | 'r', v: number) => { const n = { ...off, [k]: v }; setOff(n); eng.current?.setOffset(n.x, n.z); eng.current?.setRotationY(n.r); refresh(); };
  const snap = () => { const u = eng.current?.snapshot(); if (!u) return; const a = document.createElement('a'); a.href = u; a.download = 'hx3d-preview.png'; a.click(); };
  const bed = PRINTERS[0];

  return (
    <div className="vw">
      <label className={`drop ${drag ? 'on' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}>
        <input id="vw-file" type="file" multiple accept={ACCEPT} onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
        <b>{t.drop}</b><span>{t.dropSub}</span><small>{t.limits}</small>
      </label>

      {items.length > 0 && (
        <ul className="files" aria-label={t.files}>
          {items.map((i) => (
            <li key={i.id} className={`${i.status} ${active === i.id ? 'cur' : ''}`}>
              <button type="button" className="fn" onClick={() => i.status !== 'error' && show(i)} disabled={i.status === 'error'}>
                {i.kind === 'image' && i.url ? <img src={i.url} alt="" /> : <i className="ic">3D</i>}
                <span className="nm">{i.file.name}</span><small>{fmtBytes(i.file.size)}{i.format ? ` · ${i.format.toUpperCase()}` : ''}</small>
              </button>
              {i.status === 'reading' || (i.status === 'queued') ? <span className="bar"><i style={{ width: `${i.progress}%` }} /></span> : null}
              {i.status === 'error' && <span className="er" role="alert">{i.error}</span>}
              <button type="button" className="x" onClick={() => remove(i.id)} aria-label={`${t.remove} ${i.file.name}`}>×</button>
            </li>
          ))}
        </ul>
      )}

      <div className="stage">
        <div className="canvas" ref={host} data-testid="canvas">
          {glErr && <p className="over">{t.err.gl}</p>}
          {!glErr && !info && !busy && <p className="over">{t.empty}</p>}
          {busy && <p className="over">{t.parsing}</p>}
        </div>
        <div className="tools">
          <div className="grp" role="group" aria-label="views">{(Object.keys(t.views) as ViewName[]).map((v) => <button key={v} type="button" onClick={() => view(v)}>{t.views[v]}</button>)}
            <button type="button" onClick={() => { eng.current?.resetView(); }}>{t.reset}</button></div>
          <div className="grp">
            {(['wire', 'grid', 'bed', 'bounds', 'rotate'] as const).map((k) => <button key={k} type="button" aria-pressed={opt[k]} className={opt[k] ? 'on' : ''} onClick={() => toggle(k)}>{t[k]}</button>)}
            <button type="button" onClick={snap} disabled={!info}>{t.snap}</button>
          </div>
        </div>
      </div>

      <div className="panels">
        <section className="pn"><h3>{t.info}</h3>
          <dl>
            <dt>{t.name}</dt><dd>{info?.name ?? t.na}</dd><dt>{t.format}</dt><dd>{info?.format ?? t.na}</dd><dt>{t.fsize}</dt><dd>{info ? fmtBytes(info.bytes) : t.na}</dd>
            <dt>{t.parts}</dt><dd>{info ? info.meshes : t.na}</dd><dt>{t.tris}</dt><dd>{info ? num(info.tris) : t.na}</dd><dt>{t.verts}</dt><dd>{info ? num(info.verts) : t.na}</dd>
            <dt>{t.dims}</dt><dd data-testid="dims">{meas ? `${meas.size.x.toFixed(1)} × ${meas.size.y.toFixed(1)} × ${meas.size.z.toFixed(1)} mm` : t.na}</dd>
          </dl><p className="nt">{t.unitNote}</p>
        </section>

        <section className="pn"><h3>{t.bedTitle}</h3>
          <dl><dt>{t.printer}</dt><dd>{bed.name}</dd><dt>{t.vol}</dt><dd>{bed.x} × {bed.y} × {bed.z} mm</dd></dl>
          {meas && <p className={`fit ${meas.volume === 'inside' && meas.inBed ? 'good' : 'bad'}`} data-testid="fit">{meas.volume === 'exceeds' ? t.exceeds : meas.inBed ? t.within : t.outside}</p>}
          {(['x', 'z', 'r'] as const).map((k) => (
            <label className="sl" key={k} htmlFor={`sl-${k}`}><span>{k === 'x' ? t.moveX : k === 'z' ? t.moveY : t.rot}<b>{off[k].toFixed(0)}{k === 'r' ? '°' : ' mm'}</b></span>
              <input id={`sl-${k}`} type="range" min={k === 'r' ? 0 : -(k === 'x' ? bed.x : bed.y) / 2} max={k === 'r' ? 360 : (k === 'x' ? bed.x : bed.y) / 2} value={off[k]} disabled={!info} onChange={(e) => move(k, +e.target.value)} /></label>
          ))}
          <p className="nt">{t.bedNote}</p>
        </section>

        <section className="pn"><h3>{t.color}</h3>
          <div className="sw">{SWATCHES.map((c) => <button key={c} type="button" style={{ background: c }} aria-label={c} aria-pressed={color === c} onClick={() => paint(c)} disabled={!info} />)}
            <button type="button" className="rs" onClick={() => paint(null)} disabled={!info}>{t.origColor}</button></div>
          <div className="row"><label htmlFor="cp">{t.color}</label><input id="cp" type="color" value={color ?? '#cfd2dc'} onChange={(e) => paint(e.target.value)} disabled={!info} />
            <label htmlFor="hx">{t.hex}</label><input id="hx" className="hex" value={color ?? ''} placeholder="#E86AB3" maxLength={7} onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && paint(e.target.value)} disabled={!info} /></div>
          <div className="row"><label htmlFor="bgp">{t.bg}</label><input id="bgp" type="color" value={bg} onChange={(e) => { setBg(e.target.value); eng.current?.setBackground(e.target.value); }} /></div>
          <p className="nt">{t.previewOnly}</p>
        </section>

        <section className="pn"><h3>{t.partsTitle}</h3>
          {parts.length ? (<>
            <div className="row"><button type="button" onClick={() => parts.forEach((p) => vis(p.id, true))}>{t.all}</button><button type="button" onClick={() => parts.forEach((p) => vis(p.id, false))}>{t.none}</button></div>
            <ul className="parts">{parts.map((p) => (
              <li key={p.id}><input id={`pv-${p.id}`} type="checkbox" checked={p.visible} onChange={(e) => vis(p.id, e.target.checked)} aria-label={`${p.visible ? t.hide : t.show} ${p.name}`} />
                <input className="pname" value={p.name} aria-label={t.rename} onChange={(e) => setParts((a) => a.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))} />
                <input type="color" value={p.color ?? p.origColor} onChange={(e) => paintPart(p.id, e.target.value)} aria-label={`${t.color} ${p.name}`} /></li>))}</ul>
          </>) : <p className="nt">{t.na}</p>}
          <p className="nt">{t.partsNote}</p>
        </section>
      </div>

      <div className="panels studio-row">
        <StudioPanel t={ST[lang]} engine={eng.current} geom={geom} onApply={(gs) => applyGeoms(gs)} onUndo={undo} canUndo={canUndo} />
      </div>

      {img && (
        <section className="pn img"><h3>{t.imgTitle}</h3><img src={img.url} alt={img.file.name} />
          <Link className="btn-link" href={`/${lang}/custom-order`}>{t.convert}</Link><p className="er2">{t.convertOff}</p><p className="nt">{t.imgNote}</p></section>
      )}

      <div className="acts"><Link className="btn-link" href={`/${lang}/account`}>{t.save}</Link><Link className="btn-link" href={`/${lang}/custom-order`}>{t.order}</Link><Link className="btn-link" href={`/${lang}/custom-order`}>{t.review}</Link><small>{t.soon}</small></div>
    </div>
  );
}
