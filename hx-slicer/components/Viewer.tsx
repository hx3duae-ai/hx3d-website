"use client";

import { useCallback, useRef, useState } from "react";
import Scene from "./Scene";
import { load3mf, type LoadedModel } from "@/lib/load3mf";

const fmt = (n: number) => n.toLocaleString("ar-EG");
const mm = (n: number) => n.toFixed(1);

export default function Viewer() {
  const [loaded, setLoaded] = useState<LoadedModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const open = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".3mf")) {
      setError("الرجاء اختيار ملف بصيغة 3MF");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setLoaded(await load3mf(file));
    } catch (e) {
      setLoaded(null);
      setError(e instanceof Error ? e.message : "تعذّر قراءة الملف");
    } finally {
      setBusy(false);
    }
  }, []);

  const s = loaded?.stats;

  return (
    <div
      dir="rtl"
      className="relative h-screen w-full overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        open(e.dataTransfer.files[0]);
      }}
    >
      <Scene model={loaded?.object ?? null} wireframe={wireframe} />

      <header className="absolute inset-x-0 top-0 flex items-center gap-3 bg-black/50 px-4 py-3 text-white backdrop-blur">
        <h1 className="text-lg font-bold">HX Slicer · عارض 3MF</h1>
        <button
          onClick={() => input.current?.click()}
          className="rounded bg-sky-600 px-3 py-1.5 text-sm hover:bg-sky-500"
        >
          فتح ملف
        </button>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={wireframe} onChange={(e) => setWireframe(e.target.checked)} />
          شبكة سلكية
        </label>
        <input
          ref={input}
          type="file"
          accept=".3mf"
          hidden
          onChange={(e) => {
            open(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </header>

      {s && (
        <aside className="absolute bottom-4 left-4 space-y-1 rounded bg-black/60 p-3 text-sm text-white backdrop-blur">
          <div className="font-semibold" dir="ltr">{s.name}</div>
          <div>الحجم: {(s.fileSize / 1024).toFixed(1)} KB</div>
          <div>المجسّمات: {fmt(s.meshes)}</div>
          <div>المثلثات: {fmt(s.triangles)}</div>
          <div>الرؤوس: {fmt(s.vertices)}</div>
          <div dir="ltr" className="text-end">
            {mm(s.size.x)} × {mm(s.size.y)} × {mm(s.size.z)} mm
          </div>
        </aside>
      )}

      {!loaded && !busy && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-zinc-400">
          اسحب ملف 3MF وأفلته هنا، أو اضغط «فتح ملف»
        </div>
      )}
      {busy && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
          جارٍ التحميل…
        </div>
      )}
      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 rounded bg-red-600 px-4 py-2 text-white">
          {error}
        </div>
      )}
      {dragging && (
        <div className="pointer-events-none absolute inset-4 rounded-xl border-4 border-dashed border-sky-400 bg-sky-400/10" />
      )}
    </div>
  );
}
