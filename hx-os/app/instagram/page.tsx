"use client";
import { useCallback, useEffect, useState } from "react";
import { PILLARS } from "@/lib/content-types";
import type { IgEvent, IgMetrics, IgPost, IgPostStatus, IgSettings } from "@/lib/instagram-types";
import { aed, dateTime, shortDate } from "@/lib/format";

type Tab = "metrics" | "inbox" | "schedule" | "c2d";
type Funnel = { comments: number; dms: number; catalogSent: number; catalogQueued: number; needsReply: number; leads: number; inProgress: number; delivered: number; revenue: number };
type Settings = IgSettings & { meta: boolean; metaWebhook: boolean };

const TABS: { id: Tab; label: string }[] = [
  { id: "metrics", label: "① الأداء" },
  { id: "inbox", label: "② Inbox AI" },
  { id: "schedule", label: "③ الجدولة" },
  { id: "c2d", label: "④ Comment → DM" },
];
const ACTION: Record<IgEvent["action"], { label: string; c: string }> = {
  catalog_sent: { label: "أُرسل الكتالوج", c: "var(--good)" },
  catalog_queued: { label: "بانتظار OOTTO", c: "var(--warn)" },
  needs_reply: { label: "يحتاج رد", c: "var(--info)" },
  replied: { label: "تم الرد", c: "var(--good)" },
  ignored: { label: "تجاهل", c: "var(--muted)" },
};
const POST_STATUS: Record<IgPostStatus, string> = { planned: "مخطط", ready: "جاهز", scheduled: "مجدول", posted: "منشور", skipped: "متخطى" };
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const n = (v?: number) => (v === undefined ? "—" : new Intl.NumberFormat("en").format(v));

export default function Instagram() {
  const [tab, setTab] = useState<Tab>("metrics");
  const [events, setEvents] = useState<IgEvent[]>([]);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [metrics, setMetrics] = useState<IgMetrics[]>([]);
  const [posts, setPosts] = useState<IgPost[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [test, setTest] = useState("كم السعر؟");

  const load = useCallback(async () => {
    const [e, m, p, s] = await Promise.all([
      fetch("/api/instagram/events").then((r) => r.json()),
      fetch("/api/instagram/metrics").then((r) => r.json()),
      fetch("/api/instagram/posts").then((r) => r.json()),
      fetch("/api/instagram/settings").then((r) => r.json()),
    ]);
    setEvents(e.events);
    setFunnel(e.funnel);
    setMetrics(m.snapshots);
    setPosts(p);
    setSettings(s);
  }, []);
  useEffect(() => void load(), [load]);

  async function plan() {
    const r = await fetch("/api/instagram/posts", { method: "POST", body: "{}" });
    const j = await r.json();
    setMsg(r.ok ? `✓ انضاف ${j.created.length} بوست للأسبوع` : j.error);
    load();
  }
  async function patchPost(id: string, patch: Partial<IgPost>) {
    await fetch(`/api/instagram/posts/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    load();
  }
  async function patchEvent(id: string, action: IgEvent["action"]) {
    await fetch(`/api/instagram/events/${id}`, { method: "PATCH", body: JSON.stringify({ action }) });
    load();
  }
  async function saveSettings() {
    if (!settings) return;
    const r = await fetch("/api/instagram/settings", { method: "PUT", body: JSON.stringify(settings) });
    setMsg(r.ok ? "✓ انحفظت الإعدادات" : "تعذر الحفظ");
    load();
  }
  async function simulate() {
    const r = await fetch("/api/instagram/inbound", {
      method: "POST",
      body: JSON.stringify({ kind: "comment", externalId: `test_${Date.now()}`, text: test, username: "test.customer", via: "manual" }),
    });
    const j = await r.json();
    setMsg(r.ok ? (j.event.matched ? `✓ تطابق «${j.event.matched}» — انضاف ليد في CRM والكتالوج ${j.event.action === "catalog_sent" ? "انرسل" : "في الطابور"}` : `لا يوجد تطابق (النية: ${j.event.intent})`) : j.error);
    load();
  }

  const latest = metrics[0];
  const queue = events.filter((e) => e.action === "catalog_queued" || e.action === "needs_reply");

  return (
    <>
      <div className="head">
        <div>
          <h1>Instagram — OOTTO</h1>
          <p>4 وكلاء: الأداء · Inbox يقفل المبيعات · جدولة 7 بوستات · تعليق «سعر» ← كتالوج بالخاص. كل ليد ينزل في CRM.</p>
        </div>
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div className="notice" onClick={() => setMsg(null)} style={{ cursor: "pointer" }}>
          {msg}
        </div>
      )}
      {settings && !settings.meta && (
        <div className="notice small">
          الإرسال يتم عن طريق وكلاء OOTTO (MCP). الرسائل تنتظر في الطابور لين الوكيل يرسلها. للإرسال المباشر من HX OS أضف <code>META_PAGE_TOKEN</code> و<code>IG_USER_ID</code> في ‎.env.local‎.
        </div>
      )}

      {tab === "metrics" && (
        <>
          <div className="grid g3">
            {[
              ["المتابعين", latest?.followers],
              ["المشاهدات", latest?.views],
              ["الوصول (Reach)", latest?.reach],
              ["الحفظ", latest?.saves],
              ["المشاركات", latest?.shares],
            ].map(([l, v]) => (
              <div key={l as string} className="card stat">
                <div className="label">{l}</div>
                <div className="value">{n(v as number | undefined)}</div>
              </div>
            ))}
            <div className="card stat">
              <div className="label">أفضل ريل</div>
              <div style={{ fontWeight: 700 }}>
                {latest?.topReel?.url ? (
                  <a href={latest.topReel.url} target="_blank" rel="noreferrer">
                    {latest.topReel.title || "فتح"} ↗
                  </a>
                ) : (
                  latest?.topReel?.title ?? "—"
                )}
              </div>
              <div className="delta muted">{latest?.topReel?.views ? `${n(latest.topReel.views)} مشاهدة` : ""}</div>
            </div>
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>
            {latest ? `آخر تحديث ${dateTime(latest.at)} · الفترة ${latest.period} · المصدر ${latest.source}` : "لا توجد بيانات بعد — شغّل وكيل ig-metrics في Claude Code وهو يسحب الأرقام من OOTTO."}
          </div>
          {latest?.notes && (
            <div className="card" style={{ marginTop: 12, whiteSpace: "pre-line" }}>
              <b>تحليل الوكيل</b>
              <div className="small">{latest.notes}</div>
            </div>
          )}
          {funnel && (
            <>
              <div className="section-title">من الانستا إلى المبيعات</div>
              <div className="grid g4">
                <div className="card stat"><div className="label">تعليقات + رسائل</div><div className="value">{funnel.comments + funnel.dms}</div></div>
                <div className="card stat"><div className="label">كتالوجات انرسلت</div><div className="value">{funnel.catalogSent}</div><div className="delta muted">{funnel.catalogQueued} في الطابور</div></div>
                <div className="card stat"><div className="label">ليدز انستقرام</div><div className="value">{funnel.leads}</div><div className="delta muted">{funnel.inProgress} قيد التنفيذ</div></div>
                <div className="card stat"><div className="label">مبيعات من الانستا</div><div className="value">{aed(funnel.revenue)}</div><div className="delta muted">{funnel.delivered} طلب مسلّم</div></div>
              </div>
            </>
          )}
        </>
      )}

      {tab === "inbox" && (
        <div className="card table-wrap">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b>تحتاج إجراء ({queue.length})</b>
            <span className="muted small">وكيل ig-inbox يرد من OOTTO ويحدّث الحالة هنا</span>
          </div>
          {events.length === 0 ? (
            <div className="empty small">لا توجد رسائل بعد</div>
          ) : (
            <table className="t small">
              <thead>
                <tr><th>من</th><th>النوع</th><th>النص</th><th>النية</th><th>الحالة</th><th>الوقت</th><th></th></tr>
              </thead>
              <tbody>
                {events.slice(0, 100).map((e) => (
                  <tr key={e.id}>
                    <td style={{ direction: "ltr", textAlign: "start" }}>@{e.username ?? e.igUserId ?? "?"}</td>
                    <td>{e.kind === "comment" ? "تعليق" : "رسالة"}</td>
                    <td style={{ maxWidth: 360 }}>{e.text}{e.error && <div style={{ color: "var(--bad)" }}>⚠ {e.error}</div>}</td>
                    <td>{{ price: "سعر", order: "طلب", question: "سؤال", other: "—" }[e.intent]}</td>
                    <td><span className="status-pill" style={{ ["--c" as string]: ACTION[e.action].c }}>{ACTION[e.action].label}</span></td>
                    <td className="num-cell">{dateTime(e.at)}</td>
                    <td>
                      {(e.action === "catalog_queued" || e.action === "needs_reply") && (
                        <button className="btn sm" onClick={() => patchEvent(e.id, e.action === "catalog_queued" ? "catalog_sent" : "replied")}>✓ تم</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "schedule" && (
        <>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <span className="muted small">7 بوستات بالأسبوع (4 ريلز + 3 كاروسيل) من أفكار Content OS المعتمدة أولاً. وكيل ig-scheduler يجدولها في OOTTO.</span>
            <button className="btn primary" onClick={plan}>+ خطط الأسبوع</button>
          </div>
          <div className="card table-wrap">
            {posts.length === 0 ? (
              <div className="empty small">ما في بوستات مجدولة — اضغط «خطط الأسبوع»</div>
            ) : (
              <table className="t small">
                <thead><tr><th>اليوم</th><th>الوقت</th><th>النوع</th><th>المحور</th><th>العنوان</th><th>الحالة</th></tr></thead>
                <tbody>
                  {posts.map((p) => (
                    <tr key={p.id}>
                      <td className="num-cell">{DAYS[new Date(`${p.date}T00:00:00Z`).getUTCDay()]} {shortDate(`${p.date}T08:00:00Z`)}</td>
                      <td className="num-cell">{p.time}</td>
                      <td>{p.format === "reel" ? "🎬 ريل" : "🖼 كاروسيل"}</td>
                      <td><span className="chip"><span className="dot" style={{ background: `var(--${p.pillar})` }} />{PILLARS[p.pillar].label}</span></td>
                      <td style={{ maxWidth: 340 }}>{p.title}</td>
                      <td>
                        <select className="status-select" value={p.status} onChange={(e) => patchPost(p.id, { status: e.target.value as IgPostStatus })}>
                          {Object.entries(POST_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === "c2d" && settings && (
        <div className="grid g21">
          <div className="card" style={{ display: "grid", gap: 12 }}>
            <label className="f">
              الكلمات المفتاحية (افصل بفاصلة)
              <input className="in" value={settings.keywords.join("، ")} onChange={(e) => setSettings({ ...settings, keywords: e.target.value.split(/[,،]/).map((k) => k.trim()).filter(Boolean) })} />
            </label>
            <label className="f">
              رابط الكتالوج (PDF / Drive / صفحة الموقع)
              <input className="in" dir="ltr" value={settings.catalogUrl} placeholder="https://…" onChange={(e) => setSettings({ ...settings, catalogUrl: e.target.value })} />
            </label>
            <label className="f">
              رسالة الخاص — <span className="muted">{"{name}"} = اسم العميل، {"{catalog}"} = الرابط</span>
              <textarea className="in" rows={6} value={settings.catalogMessage} onChange={(e) => setSettings({ ...settings, catalogMessage: e.target.value })} />
            </label>
            <label className="f">
              رد عام تحت التعليق (اختياري)
              <input className="in" value={settings.publicReply} onChange={(e) => setSettings({ ...settings, publicReply: e.target.value })} />
            </label>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))", gap: 8 }}>
              {settings.slots.map((t, i) => (
                <label key={i} className="f">
                  {DAYS[i]}
                  <input className="in" type="time" value={t} onChange={(e) => setSettings({ ...settings, slots: settings.slots.map((x, j) => (j === i ? e.target.value : x)) })} />
                </label>
              ))}
            </div>
            <div><button className="btn primary" onClick={saveSettings}>حفظ</button></div>
          </div>
          <div className="card" style={{ display: "grid", gap: 10, alignContent: "start" }}>
            <b>جرّب تعليق</b>
            <input className="in" value={test} onChange={(e) => setTest(e.target.value)} />
            <button className="btn" onClick={simulate}>محاكاة تعليق من @test.customer</button>
            <div className="muted small">
              OOTTO أو Make يرسلون كل تعليق إلى <code dir="ltr">POST /api/instagram/inbound</code>. Webhook ميتا المباشر: <code dir="ltr">/api/webhooks/meta</code>
              {settings.metaWebhook ? " (مفعّل)" : " (أضف META_VERIFY_TOKEN)"}.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
