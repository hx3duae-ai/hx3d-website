"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DAYS,
  POST_STATUS,
  PRICING_RULE,
  fill,
  matchRule,
  type IgSettings,
  type KeywordRule,
  type MetricSnapshot,
  type PostStatus,
  type ScheduledPost,
} from "@/lib/instagram-types";
import { PILLARS, type Idea, type Pillar } from "@/lib/content-types";
import { dateTime } from "@/lib/format";

type Tab = "metrics" | "inbox" | "scheduler" | "c2dm";
const nf = (n: number) => new Intl.NumberFormat("en").format(n);

export default function InstagramPage() {
  const [tab, setTab] = useState<Tab>("metrics");
  const [s, setS] = useState<IgSettings | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/instagram/settings").then((r) => r.json()).then(setS);
  }, []);

  async function save(patch: Partial<IgSettings>) {
    const next = await fetch("/api/instagram/settings", { method: "PUT", body: JSON.stringify(patch) }).then((r) => r.json());
    setS(next);
    setSaved("✓ انحفظ");
    setTimeout(() => setSaved(null), 1500);
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>Instagram · OOTTO</h1>
          <p>4 وكلاء: الأداء، الإنبوكس، الجدولة، وتعليق ← رسالة. OOTTO ينفّذ داخل Claude، وHX OS يحفظ الخطة والقواعد ويربطها بالـ CRM.</p>
        </div>
        <div className="row">
          {saved && <span className="chip">{saved}</span>}
          <a className="btn" href="https://www.ootto.ai/claude-connector" target="_blank" rel="noreferrer">
            ربط OOTTO بـ Claude ↗
          </a>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {(
          [
            ["metrics", "1 · Metrics"],
            ["inbox", "2 · Inbox AI"],
            ["scheduler", "3 · Scheduler"],
            ["c2dm", "4 · Comment → DM"],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} role="tab" aria-selected={tab === k}>
            {l}
          </button>
        ))}
      </div>
      <div style={{ height: 16 }} />

      {!s ? (
        <div className="card empty">…</div>
      ) : tab === "metrics" ? (
        <Metrics handle={s.handle} />
      ) : tab === "inbox" ? (
        <Inbox s={s} save={save} />
      ) : tab === "scheduler" ? (
        <Scheduler s={s} save={save} />
      ) : (
        <CommentToDM s={s} save={save} />
      )}
    </>
  );
}

// ---------- shared ----------
function CopyBox({ title, text, hint }: { title: string; text: string; hint?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="card" style={{ background: "var(--surface-2)" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <b>{title}</b>
          {hint && <div className="muted small">{hint}</div>}
        </div>
        <button
          className="btn sm primary"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setOk(true);
            setTimeout(() => setOk(false), 1500);
          }}
        >
          {ok ? "✓ تم النسخ" : "نسخ"}
        </button>
      </div>
      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, margin: "10px 0 0", maxHeight: 220, overflow: "auto" }}>{text}</pre>
    </div>
  );
}

// ---------- 1. Metrics ----------
const FIELDS: [keyof MetricSnapshot, string][] = [
  ["followers", "Followers"],
  ["views", "Views"],
  ["reach", "Reach"],
  ["saves", "Saves"],
  ["shares", "Shares"],
];

function Metrics({ handle }: { handle: string }) {
  const [rows, setRows] = useState<MetricSnapshot[]>([]);
  const [f, setF] = useState<Record<string, string>>({});
  const [q, setQ] = useState("وش أفضل نوع محتوى عندي هالشهر؟ وليش؟");
  const load = useCallback(() => fetch("/api/instagram/metrics").then((r) => r.json()).then(setRows), []);
  useEffect(() => {
    load();
  }, [load]);
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];

  async function add() {
    await fetch("/api/instagram/metrics", { method: "POST", body: JSON.stringify(f) });
    setF({});
    load();
  }

  const history = rows
    .slice(-12)
    .map((r) => `${r.date}: followers ${r.followers}, views ${r.views}, reach ${r.reach}, saves ${r.saves}, shares ${r.shares}${r.topReel ? `, top reel ${r.topReel} (${r.topReelViews ?? "?"} views)` : ""}`)
    .join("\n");
  const pullPrompt = `استخدم OOTTO واسحب أرقام حساب انستقرام ${handle} لآخر 7 أيام: Followers, Views, Reach, Saves, Shares, وأفضل ريل (الرابط وعدد المشاهدات).
اعرضها في جدول، ثم أعطني JSON بهذا الشكل حتى ألصقه في HX OS:
{"date":"YYYY-MM-DD","followers":0,"views":0,"reach":0,"saves":0,"shares":0,"topReel":"","topReelViews":0}
لو OOTTO ما يعطي رقم معيّن، قل "غير متاح" ولا تخمّن.`;
  const askPrompt = `أنت محلل أداء انستقرام لـ HX 3D UAE (طباعة ثلاثية الأبعاد، دبي).
هذي بيانات الحساب المحفوظة عندي:
${history || "(لا توجد بيانات بعد)"}
استخدم OOTTO لو تحتاج تفاصيل البوستات. جاوب من البيانات فقط وبدون تخمين:
${q}`;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {FIELDS.map(([k, l]) => {
          const v = last ? (last[k] as number) : null;
          const d = last && prev ? (last[k] as number) - (prev[k] as number) : null;
          return (
            <div key={k} className="card stat">
              <div className="label">{l}</div>
              <div className="value">{v == null ? "—" : nf(v)}</div>
              <div className="delta" style={{ color: d == null ? "var(--muted)" : d >= 0 ? "var(--good)" : "var(--bad)" }}>
                {d == null ? (last ? `آخر تحديث ${last.date}` : "ما فيه بيانات") : `${d >= 0 ? "▲" : "▼"} ${nf(Math.abs(d))} عن ${prev!.date}`}
              </div>
            </div>
          );
        })}
        <div className="card stat">
          <div className="label">Top Reel</div>
          <div className="small" style={{ fontWeight: 700, wordBreak: "break-all" }}>
            {last?.topReel ? (
              last.topReel.startsWith("http") ? (
                <a href={last.topReel} target="_blank" rel="noreferrer">
                  فتح الريل ↗
                </a>
              ) : (
                last.topReel
              )
            ) : (
              "—"
            )}
          </div>
          <div className="delta muted">{last?.topReelViews != null ? `${nf(last.topReelViews)} مشاهدة` : ""}</div>
        </div>
      </div>

      <div className="card">
        <b>إضافة قراءة (يدوي أو من JSON اللي يعطيك Claude)</b>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginTop: 10 }}>
          <label className="f">
            التاريخ
            <input className="in" type="date" value={f.date ?? ""} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </label>
          {FIELDS.map(([k, l]) => (
            <label key={k} className="f">
              {l}
              <input className="in" type="number" min={0} dir="ltr" value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </label>
          ))}
          <label className="f">
            Top Reel (رابط)
            <input className="in" dir="ltr" value={f.topReel ?? ""} onChange={(e) => setF({ ...f, topReel: e.target.value })} />
          </label>
          <label className="f">
            مشاهدات الريل
            <input className="in" type="number" min={0} dir="ltr" value={f.topReelViews ?? ""} onChange={(e) => setF({ ...f, topReelViews: e.target.value })} />
          </label>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={add}>
            حفظ القراءة
          </button>
          <button
            className="btn"
            onClick={() => {
              const t = prompt("ألصق JSON من Claude:");
              if (!t) return;
              try {
                const j = JSON.parse(t);
                setF(Object.fromEntries(Object.entries(j).map(([k, v]) => [k, String(v ?? "")])));
              } catch {
                alert("JSON غير صالح");
              }
            }}
          >
            لصق JSON
          </button>
        </div>
      </div>

      <div className="grid g21">
        <CopyBox title="اسحب الأرقام من OOTTO" hint="انسخه والصقه في Claude (OOTTO لازم يكون مربوط)" text={pullPrompt} />
        <div className="card" style={{ display: "grid", gap: 8 }}>
          <b>اسأل عن الأداء</b>
          <textarea className="in" rows={3} value={q} onChange={(e) => setQ(e.target.value)} />
          <CopyBox title="البرومبت الجاهز" text={askPrompt} />
        </div>
      </div>

      {rows.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  {FIELDS.map(([, l]) => (
                    <th key={l}>{l}</th>
                  ))}
                  <th>Top Reel</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.id}>
                    <td>{r.date}</td>
                    {FIELDS.map(([k]) => (
                      <td key={k} className="num-cell">
                        {nf(r[k] as number)}
                      </td>
                    ))}
                    <td className="small">{r.topReelViews != null ? nf(r.topReelViews) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 2. Inbox AI ----------
function Inbox({ s, save }: { s: IgSettings; save: (p: Partial<IgSettings>) => Promise<void> }) {
  const [playbook, setPlaybook] = useState(s.playbook);
  const [lead, setLead] = useState({ username: "", message: "", phone: "", budget: "" });
  const [msg, setMsg] = useState<string | null>(null);

  const setupPrompt = `فعّل ردود رسائل انستقرام (DMs) في OOTTO لحساب ${s.handle} بهذي التعليمات:

${fill(playbook, s)}

${PRICING_RULE}

قبل ما تشغّله: اعرض علي 3 أمثلة ردود على رسائل حقيقية من الإنبوكس عشان أوافق عليها.
وبعد كل محادثة جدية أعطني سطر JSON للـ CRM:
{"username":"@...","name":"","message":"ملخص الطلب","phone":"","budget":0}`;

  async function addLead() {
    const r = await fetch("/api/instagram/leads", { method: "POST", body: JSON.stringify(lead) });
    setMsg(r.ok ? `✓ انضاف ${lead.username} للـ CRM كليد` : (await r.json()).error);
    if (r.ok) setLead({ username: "", message: "", phone: "", budget: "" });
  }

  return (
    <div className="grid g21">
      <div className="grid" style={{ gap: 16 }}>
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <b>سكريبت المبيعات (Playbook)</b>
          <textarea className="in" rows={9} value={playbook} onChange={(e) => setPlaybook(e.target.value)} />
          <div className="notice">🔒 {PRICING_RULE}</div>
          <div className="row">
            <button className="btn primary" onClick={() => save({ playbook })}>
              حفظ
            </button>
            <span className="muted small">يستخدم {"{whatsapp} {booking} {catalog}"} من إعدادات «Comment → DM».</span>
          </div>
        </div>
        <CopyBox title="برومبت تفعيل Inbox AI في OOTTO" hint="الصقه في Claude بعد ربط OOTTO" text={setupPrompt} />
      </div>
      <div className="card" style={{ display: "grid", gap: 10, alignContent: "start" }}>
        <b>ليد من انستقرام ← CRM</b>
        <div className="muted small">الصق هنا اللي يطلعه Claude من المحادثة، أو أرسله على POST /api/instagram/leads</div>
        {msg && <div className="notice">{msg}</div>}
        <label className="f">
          اليوزر *
          <input className="in" dir="ltr" placeholder="@client" value={lead.username} onChange={(e) => setLead({ ...lead, username: e.target.value })} />
        </label>
        <label className="f">
          الطلب
          <textarea className="in" rows={3} value={lead.message} onChange={(e) => setLead({ ...lead, message: e.target.value })} />
        </label>
        <label className="f">
          الجوال
          <input className="in" dir="ltr" value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} />
        </label>
        <label className="f">
          الميزانية (درهم)
          <input className="in" type="number" dir="ltr" value={lead.budget} onChange={(e) => setLead({ ...lead, budget: e.target.value })} />
        </label>
        <button className="btn primary" disabled={!lead.username.trim()} onClick={addLead}>
          + أضف للـ CRM
        </button>
      </div>
    </div>
  );
}

// ---------- 3. Scheduler ----------
function Scheduler({ s, save }: { s: IgSettings; save: (p: Partial<IgSettings>) => Promise<void> }) {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [ideas, setIdeas] = useState<Record<string, Idea>>({});
  const [busy, setBusy] = useState(false);
  const [slots, setSlots] = useState(s.slots);
  const load = useCallback(async () => {
    const [p, i] = await Promise.all([fetch("/api/instagram/posts").then((r) => r.json()), fetch("/api/content/ideas").then((r) => r.json())]);
    setPosts(p);
    setIdeas(Object.fromEntries((i.ideas as Idea[]).map((x) => [x.id, x])));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const upcoming = useMemo(() => posts.filter((p) => p.status !== "posted" && Date.parse(p.at) > Date.now() - 86400_000), [posts]);

  async function plan() {
    setBusy(true);
    await fetch("/api/instagram/posts", { method: "POST" });
    await load();
    setBusy(false);
  }
  async function patch(id: string, b: Partial<ScheduledPost>) {
    await fetch(`/api/instagram/posts/${id}`, { method: "PATCH", body: JSON.stringify(b) });
    load();
  }
  async function remove(id: string) {
    await fetch(`/api/instagram/posts/${id}`, { method: "DELETE" });
    load();
  }

  const approved = upcoming.filter((p) => p.status === "approved");
  const ootto = `استخدم OOTTO وجهّز وجدول هذي البوستات على انستقرام ${s.handle} (توقيت دبي). سوّ كل بوست بنفس الفورمات المكتوب، واعرض علي كل واحد قبل النشر:

${approved
  .map((p, i) => {
    const idea = ideas[p.ideaId];
    return `${i + 1}) ${dateTime(p.at)} — ${p.format === "reel" ? "Reel" : "Carousel"}
العنوان: ${p.title}
${idea?.hook ? `الهوك: ${idea.hook}\n` : ""}${idea?.carousel ? `الكابشن:\n${idea.carousel.caption}\n${idea.carousel.hashtags.join(" ")}\n` : ""}${
      p.format === "reel" && idea?.reel ? `المشاهد: ${idea.reel.scenes.map((x) => x.onScreen).join(" / ")}\n` : ""
    }`;
  })
  .join("\n")}`;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <b>الأسبوع القادم — 7 بوستات</b>
            <div className="muted small">يختار من أفكار Content OS (المعتمدة أولاً)، يبدّل بين الأقسام الثلاثة، ويعبّي الأيام الفاضية بس.</div>
          </div>
          <button className="btn primary" onClick={plan} disabled={busy}>
            {busy ? "…" : "⚡ جدول الأسبوع تلقائياً"}
          </button>
        </div>
      </div>

      {upcoming.length === 0 ? (
        <div className="card empty">ما فيه بوستات مجدولة — اضغط «جدول الأسبوع تلقائياً».</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>الموعد</th>
                  <th>الفورمات</th>
                  <th>البوست</th>
                  <th>الحالة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {upcoming.map((p) => (
                  <tr key={p.id}>
                    <td className="num-cell">{dateTime(p.at)}</td>
                    <td>
                      <select className="status-select" value={p.format} onChange={(e) => patch(p.id, { format: e.target.value as ScheduledPost["format"] })}>
                        <option value="reel">Reel</option>
                        <option value="carousel">Carousel</option>
                      </select>
                    </td>
                    <td>
                      <span className="dot" style={{ background: `var(--${p.pillar})`, marginInlineEnd: 6 }} />
                      {p.title}
                      <div className="muted small">{PILLARS[p.pillar as Pillar]?.label}</div>
                    </td>
                    <td>
                      <select className="status-select" value={p.status} onChange={(e) => patch(p.id, { status: e.target.value as PostStatus })}>
                        {(Object.keys(POST_STATUS) as PostStatus[]).map((k) => (
                          <option key={k} value={k}>
                            {POST_STATUS[k]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button className="btn ghost sm danger" onClick={() => remove(p.id)} aria-label="حذف">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CopyBox
        title={`أرسل المعتمد لـ OOTTO (${approved.length})`}
        hint="اعتمد البوستات أولاً، بعدين انسخ والصق في Claude. بعد الإرسال غيّر الحالة إلى «أُرسل لـ OOTTO»."
        text={approved.length ? ootto : "اعتمد بوست واحد على الأقل من الجدول فوق."}
      />

      <div className="card">
        <b>أوقات النشر (توقيت دبي)</b>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginTop: 10 }}>
          {slots.map((sl, i) => (
            <div key={sl.day} className="card" style={{ padding: 10, display: "grid", gap: 6 }}>
              <b className="small">{DAYS[sl.day]}</b>
              <input className="in" type="time" value={sl.time} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
              <select className="in" value={sl.format} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, format: e.target.value as "reel" | "carousel" } : x)))}>
                <option value="reel">Reel</option>
                <option value="carousel">Carousel</option>
              </select>
            </div>
          ))}
        </div>
        <button className="btn primary" style={{ marginTop: 10 }} onClick={() => save({ slots })}>
          حفظ الأوقات
        </button>
      </div>
    </div>
  );
}

// ---------- 4. Comment → DM ----------
function CommentToDM({ s, save }: { s: IgSettings; save: (p: Partial<IgSettings>) => Promise<void> }) {
  const [form, setForm] = useState({ handle: s.handle, whatsapp: s.whatsapp, catalogUrl: s.catalogUrl, bookingUrl: s.bookingUrl });
  const [rules, setRules] = useState<KeywordRule[]>(s.rules);
  const [test, setTest] = useState("كم السعر؟ 😍");
  const live = { ...s, ...form, rules };
  const hit = matchRule(test, rules);
  const missing = !form.whatsapp || !form.catalogUrl;

  const setupPrompt = `فعّل «Comment to DM» في OOTTO لحساب ${form.handle} على كل البوستات والريلز:
${rules
  .filter((r) => r.active)
  .map(
    (r, i) => `
قاعدة ${i + 1} — الكلمات: ${r.keywords.join("، ")}
الرد العام على التعليق: ${r.reply}
الرسالة الخاصة:
${fill(r.dm, live)}`,
  )
  .join("\n")}

أرسل كل شخص يطلب الكتالوج كليد في سطر JSON: {"username":"@...","message":"علّق: ..."}`;

  const upd = (i: number, p: Partial<KeywordRule>) => setRules(rules.map((r, j) => (j === i ? { ...r, ...p } : r)));

  return (
    <div className="grid" style={{ gap: 16 }}>
      {missing && <div className="notice">أضف رقم الواتساب ورابط الكتالوج تحت — بدونها الرسالة بتطلع ناقصة.</div>}
      <div className="card">
        <b>بيانات الكتالوج</b>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 10 }}>
          {(
            [
              ["handle", "حساب انستقرام"],
              ["whatsapp", "واتساب (+971…)"],
              ["catalogUrl", "رابط الكتالوج (PDF / Drive)"],
              ["bookingUrl", "رابط Cal.com"],
            ] as const
          ).map(([k, l]) => (
            <label key={k} className="f">
              {l}
              <input className="in" dir="ltr" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </label>
          ))}
        </div>
      </div>

      {rules.map((r, i) => (
        <div key={r.id} className="card" style={{ display: "grid", gap: 10 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b>قاعدة {i + 1}</b>
            <div className="row">
              <label className="row small">
                <input type="checkbox" checked={r.active} onChange={(e) => upd(i, { active: e.target.checked })} /> مفعّلة
              </label>
              <button className="btn ghost sm danger" onClick={() => setRules(rules.filter((_, j) => j !== i))}>
                حذف
              </button>
            </div>
          </div>
          <label className="f">
            الكلمات (افصل بفاصلة)
            <input className="in" value={r.keywords.join("، ")} onChange={(e) => upd(i, { keywords: e.target.value.split(/[،,]/).map((x) => x.trim()) })} />
          </label>
          <label className="f">
            الرد العام على التعليق
            <input className="in" value={r.reply} onChange={(e) => upd(i, { reply: e.target.value })} />
          </label>
          <label className="f">
            الرسالة الخاصة ({r.dm.length}/1000)
            <textarea className="in" rows={7} maxLength={1000} value={r.dm} onChange={(e) => upd(i, { dm: e.target.value })} />
          </label>
        </div>
      ))}
      <div className="row">
        <button
          className="btn"
          onClick={() => setRules([...rules, { id: `rule_${Date.now()}`, keywords: [], reply: "", dm: "", active: true }])}
        >
          + قاعدة جديدة
        </button>
        <button className="btn primary" onClick={() => save({ ...form, rules: rules.map((r) => ({ ...r, keywords: r.keywords.filter(Boolean) })) })}>
          حفظ القواعد
        </button>
      </div>

      <div className="grid g21">
        <div className="card" style={{ display: "grid", gap: 8 }}>
          <b>جرّب تعليق</b>
          <input className="in" value={test} onChange={(e) => setTest(e.target.value)} />
          {hit ? (
            <>
              <div className="small">
                <span className="status-pill status-delivered">يطابق</span> الرد: {hit.reply}
              </div>
              <div className="card" style={{ whiteSpace: "pre-line", background: "var(--surface-2)" }}>
                {fill(hit.dm, live)}
              </div>
            </>
          ) : (
            <div className="muted small">ما يطابق أي قاعدة — ما بينرسل شي.</div>
          )}
        </div>
        <CopyBox title="برومبت تفعيل Comment → DM في OOTTO" hint="انسخه والصقه في Claude" text={setupPrompt} />
      </div>
    </div>
  );
}
