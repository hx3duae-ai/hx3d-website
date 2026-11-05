"use client";
import { use, useCallback, useEffect, useState } from "react";
import { aed } from "@/lib/format";
import type { PricingSnapshot } from "@/lib/quote-types";

type View = {
  id: string;
  status: string;
  statusLabel: string;
  missingInfo: string[];
  details: { title: string; description?: string; quantity?: number };
  files: { name: string; size: number }[];
  quotation: (PricingSnapshot & { sentAt: string }) | null;
  customerResponse?: { decision: string };
};

// Customer's private page. The amount only exists here after the owner approved AND sent it.
export default function CustomerQuote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [key, setKey] = useState<string | null>(null);
  const [v, setV] = useState<View | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async (k: string) => {
    const r = await fetch(`/api/public/quotes/${id}`, { headers: { "x-quote-key": k } });
    if (r.ok) setV(await r.json());
    else setMsg("الرابط غير صحيح");
  }, [id]);

  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("key");
    setKey(k);
    if (k) load(k);
    else setMsg("الرابط غير صحيح");
  }, [load]);

  async function respond(decision: "accepted" | "declined") {
    const r = await fetch(`/api/public/quotes/${id}`, { method: "POST", headers: { "x-quote-key": key ?? "" }, body: JSON.stringify({ decision }) });
    setMsg(r.ok ? "✓ وصلنا ردك" : (await r.json()).error);
    if (key) load(key);
  }

  async function upload(files: FileList | null) {
    for (const f of Array.from(files ?? [])) {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch(`/api/public/quotes/${id}/files`, { method: "POST", headers: { "x-quote-key": key ?? "" }, body: fd });
      setMsg(r.ok ? `✓ رُفع ${f.name}` : (await r.json()).error);
    }
    if (key) load(key);
  }

  if (!v) return <div className="card">{msg ?? "…"}</div>;
  const q = v.quotation;
  return (
    <>
      <div className="head">
        <div>
          <h1>{v.details.title}</h1>
          <p>الحالة: {v.statusLabel}</p>
        </div>
      </div>
      {msg && <div className="notice">{msg}</div>}
      {v.missingInfo.length > 0 && (
        <div className="notice">
          نحتاج منك: <ul>{v.missingInfo.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}
      <div className="card" style={{ display: "grid", gap: 8 }}>
        <b>الملفات</b>
        {v.files.length ? v.files.map((f) => <div key={f.name}>📎 {f.name}</div>) : <span className="muted">لا توجد ملفات</span>}
        {!q && <input className="in" type="file" multiple onChange={(e) => upload(e.target.files)} />}
      </div>
      <div className="card" style={{ display: "grid", gap: 8, marginTop: 16 }}>
        <b>عرض السعر</b>
        {!q ? (
          <span className="muted">صاحب العمل يراجع طلبك ويحدد السعر بنفسه. يظهر العرض هنا بعد اعتماده.</span>
        ) : (
          <>
            <table className="t">
              <thead>
                <tr><th>البند</th><th>الكمية</th><th>سعر الوحدة</th><th>المجموع</th></tr>
              </thead>
              <tbody>
                {q.lines.map((l, i) => (
                  <tr key={i}><td>{l.desc}</td><td>{l.qty}</td><td>{aed(l.unit)}</td><td>{aed(l.qty * l.unit)}</td></tr>
                ))}
              </tbody>
            </table>
            <div>
              <b>الإجمالي: {aed(q.total)}</b> {q.vatIncluded ? "(شامل الضريبة)" : "(غير شامل الضريبة)"}
            </div>
            {q.validUntil && <div className="muted small">صالح حتى {q.validUntil}</div>}
            {q.customerNote && <div>{q.customerNote}</div>}
            {v.status === "sent" ? (
              <div className="row">
                <button className="btn primary" onClick={() => respond("accepted")}>أوافق على العرض</button>
                <button className="btn" onClick={() => respond("declined")}>لا أوافق</button>
              </div>
            ) : (
              <div className="muted">ردك: {v.status === "accepted" ? "موافق" : "غير موافق"}</div>
            )}
          </>
        )}
      </div>
    </>
  );
}
