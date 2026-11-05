"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { aed, dateTime } from "@/lib/format";
import { QUOTE_STATUS, STAFF_STATUS, type Pricing, type QuoteRequest, type StaffStatus } from "@/lib/quote-types";

type Q = Omit<QuoteRequest, "customerKeyHash"> & { statusLabel: string; pricing?: Pricing | null };
type Me = { role: "owner" | "employee" | "agent" | "anonymous"; id: string; ownerConfigured: boolean };
type Audit = { id: string; at: string; actor: { role: string; id: string }; action: string; detail?: Record<string, unknown> };

const OWNER_DECIDED = ["approved", "rejected", "sent", "accepted", "declined"];

// Quotation requests. UI controls are hints only — every rule is enforced by the API.
export default function Quotes() {
  const [me, setMe] = useState<Me | null>(null);
  const [rows, setRows] = useState<Q[]>([]);
  const [sel, setSel] = useState<Q | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const m: Me = await fetch("/api/auth/me").then((r) => r.json());
    setMe(m);
    if (m.role === "anonymous") return;
    const r = await fetch("/api/quotes");
    if (r.ok) setRows(await r.json());
  }, []);
  useEffect(() => void load(), [load]);

  const open = useCallback(async (id: string) => {
    const r = await fetch(`/api/quotes/${id}`);
    if (r.ok) setSel(await r.json());
  }, []);

  async function call(url: string, method: string, data?: unknown) {
    const r = await fetch(url, { method, body: data === undefined ? undefined : JSON.stringify(data) });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? "✓ تم" : j.error ?? "خطأ");
    await load();
    if (sel) await open(sel.id);
    return r.ok;
  }

  if (!me) return <div className="card">…</div>;
  if (me.role === "anonymous")
    return (
      <div className="card">
        هذه الصفحة للفريق. <Link href="/login">سجّل الدخول</Link> — أو للعملاء: <Link href="/request">طلب عرض سعر</Link>
      </div>
    );
  const owner = me.role === "owner";

  return (
    <>
      <div className="head">
        <div>
          <h1>طلبات عروض الأسعار</h1>
          <p>{owner ? "أنت المالك: التسعير والاعتماد والإرسال بيدك فقط." : "تقدر تدير الطلب وحالته — التسعير للمالك فقط 🔒"}</p>
        </div>
        <Link className="btn" href="/request">+ طلب جديد</Link>
      </div>
      {msg && (
        <div className="notice" onClick={() => setMsg(null)} style={{ cursor: "pointer" }}>
          {msg}
        </div>
      )}
      <div className="grid g21">
        <div className="card" style={{ padding: 0 }}>
          {rows.length === 0 ? (
            <div className="empty">لا توجد طلبات{me.role === "employee" ? " مُعيّنة لك" : ""}</div>
          ) : (
            <table className="t">
              <thead>
                <tr><th>العميل</th><th>الطلب</th><th>الحالة</th><th>التاريخ</th></tr>
              </thead>
              <tbody>
                {rows.map((q) => (
                  <tr key={q.id} onClick={() => open(q.id)} style={{ cursor: "pointer", background: sel?.id === q.id ? "var(--line, #0001)" : undefined }}>
                    <td><b>{q.customer.name}</b><div className="muted small">{q.source}</div></td>
                    <td>{q.details.title}</td>
                    <td>{q.statusLabel}</td>
                    <td className="small">{dateTime(q.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {sel && <Detail key={sel.id + sel.updatedAt} q={sel} owner={owner} call={call} />}
      </div>
    </>
  );
}

function Detail({ q, owner, call }: { q: Q; owner: boolean; call: (u: string, m: string, d?: unknown) => Promise<boolean> }) {
  const locked = OWNER_DECIDED.includes(q.status) && !owner;
  const [missing, setMissing] = useState((q.missingInfo ?? []).join("\n"));
  const [assigned, setAssigned] = useState(q.assignedTo.join(", "));
  const p = q.pricing;
  const [lines, setLines] = useState(p ? p.lines.map((l) => `${l.desc} | ${l.qty} | ${l.unit}`).join("\n") : "");
  const [vatIncluded, setVat] = useState(p?.vatIncluded ?? false);
  const [validUntil, setValid] = useState(p?.validUntil ?? "");
  const [customerNote, setCNote] = useState(p?.customerNote ?? "");
  const [internalNote, setINote] = useState(p?.internalNote ?? "");
  const [audit, setAudit] = useState<Audit[] | null>(null);
  const base = `/api/quotes/${q.id}`;

  const parsed = lines
    .split("\n")
    .map((l) => l.split("|").map((x) => x.trim()))
    .filter((a) => a.length >= 3 && a[0])
    .map((a) => ({ desc: a[0], qty: Number(a[1]), unit: Number(a[2]) }));

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card" style={{ display: "grid", gap: 6 }}>
        <b>{q.details.title}</b>
        <div className="small">
          {q.customer.name} {q.customer.company && `· ${q.customer.company}`} · <span dir="ltr">{[q.customer.phone, q.customer.email].filter(Boolean).join(" · ")}</span>
        </div>
        {q.details.description && <div style={{ whiteSpace: "pre-wrap" }}>{q.details.description}</div>}
        <div className="small muted">
          {[
            q.details.quantity && `الكمية: ${q.details.quantity}`,
            q.details.material && `الخامة: ${q.details.material}`,
            q.details.colors && `الألوان: ${q.details.colors}`,
            q.details.size && `المقاس: ${q.details.size}`,
            q.details.deadline && `الموعد: ${q.details.deadline}`,
            q.details.delivery && `التوصيل: ${q.details.delivery}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
        <b>الملفات</b>
        {q.files.length === 0 && <span className="muted small">لا توجد ملفات</span>}
        {q.files.map((f) =>
          owner ? (
            <a key={f.id} href={`${base}/files/${f.id}`}>📎 {f.name} <span className="muted small">({Math.round(f.size / 1024)} KB)</span></a>
          ) : (
            <span key={f.id}>📎 {f.name}</span>
          ),
        )}
        <div>
          الحالة: <b>{QUOTE_STATUS[q.status]}</b>
        </div>
        {locked ? (
          <div className="muted small">🔒 قرار المالك — لا يمكن تغييره</div>
        ) : (
          <select className="in" value={q.status in STAFF_STATUS ? q.status : ""} onChange={(e) => call(base, "PATCH", { status: e.target.value })}>
            <option value="" disabled>
              {QUOTE_STATUS[q.status]}
            </option>
            {(Object.keys(STAFF_STATUS) as StaffStatus[]).map((s) => (
              <option key={s} value={s}>{STAFF_STATUS[s]}</option>
            ))}
          </select>
        )}
        {!locked && (
          <>
            <label className="f">
              معلومات ناقصة نطلبها من العميل (سطر لكل نقطة)
              <textarea className="in" rows={3} value={missing} onChange={(e) => setMissing(e.target.value)} />
            </label>
            <button className="btn" onClick={() => call(base, "PATCH", { missingInfo: missing.split("\n").filter(Boolean) })}>حفظ</button>
          </>
        )}
        {owner && (
          <label className="f">
            تعيين لموظفين (معرّفات مفصولة بفاصلة)
            <div className="row">
              <input className="in" dir="ltr" value={assigned} onChange={(e) => setAssigned(e.target.value)} />
              <button className="btn" onClick={() => call(base, "PATCH", { assignedTo: assigned.split(",").map((s) => s.trim()).filter(Boolean) })}>تعيين</button>
            </div>
          </label>
        )}
      </div>

      {owner ? (
        <div className="card" style={{ display: "grid", gap: 8 }}>
          <b>💰 التسعير — المالك فقط</b>
          <div className="muted small">
            أدخل الأسعار بنفسك. النظام لا يحسب ولا يقترح أي سعر — يجمع أرقامك فقط. أي تعديل يرجع العرض لمسودة ويحتاج اعتماد من جديد.
          </div>
          <label className="f">
            البنود: الوصف | الكمية | سعر الوحدة (درهم) — سطر لكل بند
            <textarea className="in" rows={4} dir="auto" value={lines} onChange={(e) => setLines(e.target.value)} />
          </label>
          <label className="row small">
            <input type="checkbox" checked={vatIncluded} onChange={(e) => setVat(e.target.checked)} /> الأسعار شاملة الضريبة
          </label>
          <label className="f">صالح حتى<input className="in" type="date" value={validUntil} onChange={(e) => setValid(e.target.value)} /></label>
          <label className="f">ملاحظة تظهر للعميل<textarea className="in" rows={2} value={customerNote} onChange={(e) => setCNote(e.target.value)} /></label>
          <label className="f">ملاحظة داخلية (لا تظهر لأحد غيرك)<textarea className="in" rows={2} value={internalNote} onChange={(e) => setINote(e.target.value)} /></label>
          <div className="small">مجموع أرقامك: <b>{aed(parsed.reduce((a, l) => a + (l.qty || 0) * (l.unit || 0), 0))}</b></div>
          <div className="row">
            <button className="btn primary" disabled={!parsed.length} onClick={() => call(`${base}/pricing`, "PUT", { lines: parsed, vatIncluded, validUntil, customerNote, internalNote })}>
              حفظ الأسعار
            </button>
            <button className="btn" disabled={!p} onClick={() => call(`${base}/decision`, "POST", { decision: "approved" })}>اعتماد</button>
            <button className="btn" onClick={() => call(`${base}/decision`, "POST", { decision: "rejected" })}>رفض</button>
            <button className="btn" disabled={p?.decision !== "approved"} onClick={() => confirm("إرسال العرض المعتمد للعميل؟") && call(`${base}/send`, "POST")}>
              إرسال للعميل
            </button>
          </div>
          {p && (
            <div className="muted small">
              النسخة {p.version} · {p.decision === "approved" ? "معتمد" : p.decision === "rejected" ? "مرفوض" : "مسودة"}
              {p.sent && ` · آخر إرسال: النسخة ${p.sent.version} (${aed(p.sent.total)}) ${dateTime(p.sent.sentAt)}`}
            </div>
          )}
          <button
            className="btn"
            onClick={async () => {
              const r = await fetch(`${base}/audit`);
              if (r.ok) setAudit(await r.json());
            }}
          >
            سجل التدقيق
          </button>
          {audit && (
            <table className="t small">
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td>{dateTime(a.at)}</td>
                    <td>{a.actor.role}:{a.actor.id}</td>
                    <td>{a.action}</td>
                    <td dir="ltr" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>{a.detail ? JSON.stringify(a.detail) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="card muted">🔒 التسعير واعتماده وإرساله من صلاحية المالك فقط.</div>
      )}
    </div>
  );
}
