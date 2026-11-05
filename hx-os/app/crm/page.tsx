"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CLIENT_STATUS, ORDER_TYPES, type Client, type ClientStatus, type MonthStat, type OrderType } from "@/lib/crm-types";
import { aed, dateTime, monthName, shortDate } from "@/lib/format";

type Stats = { months: MonthStat[]; current: MonthStat; previous: MonthStat; pipeline: number; leads: number };
type Filter = "all" | ClientStatus;
const SOURCES: Record<Client["source"], string> = { manual: "يدوي", calcom: "📅 Cal.com", instagram: "انستقرام", whatsapp: "واتساب", referral: "توصية" };

const EMPTY: Partial<Client> = { name: "", company: "", phone: "", email: "", orderType: "corporate_gift", price: 0, status: "lead", notes: "" };

export default function CRM() {
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Partial<Client> | null>(null);
  const [cal, setCal] = useState<{ apiKey: boolean; webhookSecret: boolean } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([fetch("/api/crm/clients").then((r) => r.json()), fetch("/api/crm/stats").then((r) => r.json())]);
    setClients(c);
    setStats(s);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/crm/calcom/sync").then((r) => r.json()).then(setCal);
    setOrigin(window.location.origin);
  }, [load]);

  async function save() {
    if (!form?.name?.trim()) return;
    const isNew = !form.id;
    const res = await fetch(isNew ? "/api/crm/clients" : `/api/crm/clients/${form.id}`, {
      method: isNew ? "POST" : "PATCH",
      body: JSON.stringify(form),
    });
    if (!res.ok) return setMsg((await res.json()).error);
    setForm(null);
    load();
  }

  async function quick(id: string, patch: Partial<Client>) {
    await fetch(`/api/crm/clients/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    load();
  }

  async function remove(c: Client) {
    if (!confirm(`حذف ${c.name}؟`)) return;
    await fetch(`/api/crm/clients/${c.id}`, { method: "DELETE" });
    load();
  }

  async function toContent(c: Client) {
    const r = await fetch(`/api/crm/clients/${c.id}/to-content`, { method: "POST" });
    setMsg(r.ok ? `✓ أُضيفت فكرة «قصة عميل» لـ ${c.name} في Content OS` : "تعذر إنشاء الفكرة");
  }

  async function sync() {
    setSyncing(true);
    const r = await fetch("/api/crm/calcom/sync", { method: "POST" });
    const j = await r.json();
    setSyncing(false);
    setMsg(r.ok ? `Cal.com: ${j.created} جديد · ${j.updated} محدّث · ${j.skipped} موجود مسبقاً` : `Cal.com: ${j.error}`);
    load();
  }

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return clients.filter(
      (c) =>
        (filter === "all" || c.status === filter) &&
        (!needle || [c.name, c.company, c.phone, c.email, c.notes].some((x) => x?.toLowerCase().includes(needle))),
    );
  }, [clients, filter, q]);

  const count = (s: Filter) => (s === "all" ? clients.length : clients.filter((c) => c.status === s).length);
  const delta = stats && stats.previous.sales > 0 ? Math.round(((stats.current.sales - stats.previous.sales) / stats.previous.sales) * 100) : null;
  const max = stats ? Math.max(1, ...stats.months.map((m) => m.sales)) : 1;

  return (
    <>
      <div className="head">
        <div>
          <h1>CRM العملاء</h1>
          <p>كل طلب من ليد إلى التسليم — حجوزات Cal.com تنضاف تلقائياً، والمبيعات تنحسب شهرياً.</p>
        </div>
        <button className="btn primary" onClick={() => setForm({ ...EMPTY })}>
          + عميل / طلب جديد
        </button>
      </div>

      {msg && (
        <div className="notice" onClick={() => setMsg(null)} style={{ cursor: "pointer" }}>
          {msg}
        </div>
      )}

      {stats && (
        <div className="grid g4">
          <div className="card stat">
            <div className="label">مبيعات {monthName(stats.current.month)}</div>
            <div className="value">{aed(stats.current.sales)}</div>
            <div className="delta muted">
              {stats.current.orders} طلب مسلّم
              {delta !== null && (
                <span style={{ color: delta >= 0 ? "var(--good)" : "var(--bad)" }}>
                  {" "}
                  · {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}٪ عن {monthName(stats.previous.month)}
                </span>
              )}
            </div>
          </div>
          <div className="card stat">
            <div className="label">الشهر الماضي ({monthName(stats.previous.month)})</div>
            <div className="value">{aed(stats.previous.sales)}</div>
            <div className="delta muted">{stats.previous.orders} طلب مسلّم</div>
          </div>
          <div className="card stat">
            <div className="label">قيد التنفيذ (Pipeline)</div>
            <div className="value">{aed(stats.pipeline)}</div>
            <div className="delta muted">{count("in_progress")} طلب شغال</div>
          </div>
          <div className="card stat">
            <div className="label">ليدز مفتوحة</div>
            <div className="value">{stats.leads}</div>
            <div className="delta muted">تحتاج متابعة وتسعير</div>
          </div>
        </div>
      )}

      {stats && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b>إجمالي المبيعات الشهرية — آخر 12 شهر</b>
            <span className="muted small">حسب تاريخ التسليم · درهم</span>
          </div>
          <div className="bars" role="img" aria-label="مبيعات آخر 12 شهر">
            {stats.months.map((m, i) => (
              <div key={m.month} className={`bar ${i === stats.months.length - 1 ? "cur" : ""}`} tabIndex={0}>
                <div className="fill" style={{ height: `${(m.sales / max) * 100}%` }} />
                <span className="tip">
                  {monthName(m.month)} {m.month.slice(0, 4)}: {aed(m.sales)} · {m.orders} طلب
                </span>
              </div>
            ))}
          </div>
          <div className="bar-labels">
            {stats.months.map((m) => (
              <span key={m.month}>{monthName(m.month).slice(0, 3)}</span>
            ))}
          </div>
          <details style={{ marginTop: 10 }}>
            <summary className="muted small" style={{ cursor: "pointer" }}>
              عرض كجدول
            </summary>
            <table className="t small">
              <thead>
                <tr>
                  <th>الشهر</th>
                  <th>المبيعات</th>
                  <th>الطلبات</th>
                </tr>
              </thead>
              <tbody>
                {[...stats.months].reverse().map((m) => (
                  <tr key={m.month}>
                    <td>
                      {monthName(m.month)} {m.month.slice(0, 4)}
                    </td>
                    <td className="num-cell">{aed(m.sales)}</td>
                    <td className="num-cell">{m.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <b>Cal.com</b>{" "}
            <span className="muted small">
              {cal?.apiKey ? "· API متصل" : "· أضف CAL_API_KEY في ‎.env.local‎ للسحب"}
              {cal?.webhookSecret ? " · Webhook موقّع" : ""}
            </span>
            <div className="muted small">
              Webhook URL: <code style={{ direction: "ltr", display: "inline-block" }}>{origin}/api/webhooks/calcom</code> — على localhost يحتاج نفق
              (cloudflared / ngrok)، أو استخدم زر السحب.
            </div>
          </div>
          <button className="btn" onClick={sync} disabled={syncing || !cal?.apiKey}>
            {syncing ? "جاري السحب…" : "⟳ سحب الحجوزات الآن"}
          </button>
        </div>
      </div>

      <div className="row" style={{ justifyContent: "space-between", margin: "22px 0 12px" }}>
        <div className="tabs">
          {(["all", "lead", "in_progress", "delivered"] as Filter[]).map((f) => (
            <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
              {f === "all" ? "الكل" : CLIENT_STATUS[f]} <span className="muted small">({count(f)})</span>
            </button>
          ))}
        </div>
        <input className="in" style={{ maxWidth: 260 }} placeholder="بحث بالاسم، الشركة، الرقم…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="card" style={{ padding: 0 }}>
        {shown.length === 0 ? (
          <div className="empty">{clients.length ? "لا نتائج" : "ما فيه عملاء بعد — أضف أول طلب أو اسحب حجوزات Cal.com."}</div>
        ) : (
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>نوع الطلب</th>
                  <th>السعر</th>
                  <th>الحالة</th>
                  <th>المصدر</th>
                  <th>التاريخ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b>{c.name}</b>
                      <div className="muted small">{[c.company, c.phone, c.email].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td>{ORDER_TYPES[c.orderType].label}</td>
                    <td className="num-cell">{c.price ? aed(c.price) : <span className="muted">—</span>}</td>
                    <td>
                      <span className={`status-${c.status}`}>
                        <select
                          className="status-select status-pill"
                          value={c.status}
                          aria-label="الحالة"
                          onChange={(e) => quick(c.id, { status: e.target.value as ClientStatus })}
                        >
                          {(Object.keys(CLIENT_STATUS) as ClientStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {CLIENT_STATUS[s]}
                            </option>
                          ))}
                        </select>
                      </span>
                    </td>
                    <td className="small">
                      {SOURCES[c.source]}
                      {c.igHandle && (
                        <a href={`https://instagram.com/${c.igHandle}`} target="_blank" rel="noreferrer" className="muted" style={{ display: "block", direction: "ltr", textAlign: "start" }}>
                          @{c.igHandle}
                        </a>
                      )}
                    </td>
                    <td className="small muted">
                      {c.status === "delivered" ? `سُلّم ${shortDate(c.deliveredAt)}` : c.bookingStart ? `موعد ${dateTime(c.bookingStart)}` : shortDate(c.createdAt)}
                    </td>
                    <td>
                      <div className="row" style={{ flexWrap: "nowrap", gap: 4 }}>
                        <button className="btn ghost sm" onClick={() => setForm({ ...c })}>
                          تعديل
                        </button>
                        {c.status === "delivered" && (
                          <button className="btn ghost sm" onClick={() => toContent(c)} title="أنشئ فكرة محتوى من هذا الطلب">
                            → محتوى
                          </button>
                        )}
                        <button className="btn ghost sm danger" onClick={() => remove(c)} aria-label="حذف">
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {form && (
        <div className="modal-bg" onClick={() => setForm(null)}>
          <div className="modal" style={{ width: "min(620px,100%)" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>{form.id ? "تعديل العميل" : "عميل / طلب جديد"}</h2>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className="f">
                الاسم *
                <input className="in" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
              </label>
              <label className="f">
                الشركة
                <input className="in" value={form.company ?? ""} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </label>
              <label className="f">
                الجوال / واتساب
                <input className="in" dir="ltr" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
              <label className="f">
                الإيميل
                <input className="in" dir="ltr" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
              <label className="f">
                نوع الطلب
                <select className="in" value={form.orderType} onChange={(e) => setForm({ ...form, orderType: e.target.value as OrderType })}>
                  {(Object.keys(ORDER_TYPES) as OrderType[]).map((k) => (
                    <option key={k} value={k}>
                      {ORDER_TYPES[k].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="f">
                السعر (درهم)
                <input className="in" type="number" min={0} dir="ltr" value={form.price ?? 0} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
              </label>
              <label className="f">
                الحالة
                <select className="in" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ClientStatus })}>
                  {(Object.keys(CLIENT_STATUS) as ClientStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {CLIENT_STATUS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="f">
                المصدر
                <select className="in" value={form.source ?? "manual"} onChange={(e) => setForm({ ...form, source: e.target.value as Client["source"] })}>
                  {(Object.keys(SOURCES) as Client["source"][]).map((k) => (
                    <option key={k} value={k}>
                      {SOURCES[k]}
                    </option>
                  ))}
                </select>
              </label>
              {form.status === "delivered" && (
                <label className="f">
                  تاريخ التسليم
                  <input
                    className="in"
                    type="date"
                    value={(form.deliveredAt ?? new Date().toISOString()).slice(0, 10)}
                    onChange={(e) => setForm({ ...form, deliveredAt: `${e.target.value}T12:00:00.000Z` })}
                  />
                </label>
              )}
              <label className="f" style={{ gridColumn: "1 / -1" }}>
                ملاحظات
                <textarea className="in" rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
            </div>
            <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setForm(null)}>
                إلغاء
              </button>
              <button className="btn primary" onClick={save} disabled={!form.name?.trim()}>
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
