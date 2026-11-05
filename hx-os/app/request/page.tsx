"use client";
import { useState } from "react";

// Public quotation request form (customers). No prices are shown or calculated here.
export default function RequestQuote() {
  const [c, setC] = useState({ name: "", phone: "", email: "", company: "" });
  const [d, setD] = useState({ title: "", description: "", quantity: "", material: "", colors: "", size: "", deadline: "", delivery: "" });
  const [files, setFiles] = useState<FileList | null>(null);
  const [done, setDone] = useState<{ url: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/quotes", {
      method: "POST",
      body: JSON.stringify({ customer: c, details: { ...d, quantity: d.quantity ? Number(d.quantity) : undefined } }),
    });
    const j = await r.json();
    if (!r.ok) {
      setBusy(false);
      return setMsg(j.error);
    }
    for (const f of Array.from(files ?? [])) {
      const fd = new FormData();
      fd.append("file", f);
      const u = await fetch(`/api/public/quotes/${j.quote.id}/files`, { method: "POST", headers: { "x-quote-key": j.customerKey }, body: fd });
      if (!u.ok) setMsg(`تعذر رفع ${f.name}: ${(await u.json()).error}`);
    }
    setBusy(false);
    setDone({ url: j.customerUrl });
  }

  if (done)
    return (
      <div className="card" style={{ display: "grid", gap: 10, maxWidth: 640 }}>
        <h2>✓ وصلنا طلبك</h2>
        <p>صاحب العمل يراجع ملفاتك وتفاصيل طلبك بنفسه ويحدد السعر، وبعد اعتماده يظهر عرض السعر في رابطك الخاص:</p>
        <a href={done.url} dir="ltr">
          {typeof window !== "undefined" ? window.location.origin : ""}
          {done.url}
        </a>
        <p className="muted small">احفظ الرابط — هو مفتاحك الخاص لمتابعة الطلب.</p>
        {msg && <div className="notice">{msg}</div>}
      </div>
    );

  const inp = (label: string, v: string, on: (s: string) => void, type = "text") => (
    <label className="f">
      {label}
      <input className="in" type={type} value={v} onChange={(e) => on(e.target.value)} />
    </label>
  );
  return (
    <>
      <div className="head">
        <div>
          <h1>طلب عرض سعر</h1>
          <p>ارفع ملفك أو صورتك واكتب التفاصيل. السعر يحدده صاحب العمل بعد المراجعة.</p>
        </div>
      </div>
      {msg && <div className="notice">{msg}</div>}
      <div className="card" style={{ display: "grid", gap: 10, maxWidth: 720 }}>
        {inp("الاسم *", c.name, (v) => setC({ ...c, name: v }))}
        {inp("الجوال", c.phone, (v) => setC({ ...c, phone: v }), "tel")}
        {inp("البريد", c.email, (v) => setC({ ...c, email: v }), "email")}
        {inp("الشركة", c.company, (v) => setC({ ...c, company: v }))}
        {inp("وش تبي نطبع لك؟ *", d.title, (v) => setD({ ...d, title: v }))}
        <label className="f">
          التفاصيل
          <textarea className="in" rows={4} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
        </label>
        {inp("الكمية", d.quantity, (v) => setD({ ...d, quantity: v }), "number")}
        {inp("الخامة (PLA / PETG / TPU…)", d.material, (v) => setD({ ...d, material: v }))}
        {inp("الألوان", d.colors, (v) => setD({ ...d, colors: v }))}
        {inp("المقاس", d.size, (v) => setD({ ...d, size: v }))}
        {inp("الموعد المطلوب", d.deadline, (v) => setD({ ...d, deadline: v }), "date")}
        {inp("التوصيل (المدينة / استلام)", d.delivery, (v) => setD({ ...d, delivery: v }))}
        <label className="f">
          الملفات (STL, 3MF, OBJ, STEP, صور, PDF, ZIP — حتى 100MB)
          <input className="in" type="file" multiple onChange={(e) => setFiles(e.target.files)} />
        </label>
        <button className="btn primary" onClick={submit} disabled={busy || !c.name || !d.title || (!c.phone && !c.email)}>
          {busy ? "جارٍ الإرسال…" : "أرسل الطلب"}
        </button>
      </div>
    </>
  );
}
