// Instagram module (server side). OOTTO does the live Instagram actions inside Claude;
// HX OS keeps the plan, the rules, the playbook, the metrics history, and the CRM link.
import { all, dubaiDate, logActivity, mutate, newId, now } from "./db";
import { DEFAULT_SETTINGS, type IgSettings, type MetricSnapshot, type ScheduledPost } from "./instagram-types";
import type { Idea } from "./content-types";
import { generateDailyIdeas } from "./idea-engine";
import { toIdea } from "./content";
import { createClient, guessOrderType } from "./crm";

type SettingsRow = { id: string; value: unknown };

export async function getSettings(): Promise<IgSettings> {
  const row = (await all<SettingsRow>("settings")).find((r) => r.id === "instagram");
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<IgSettings>) ?? {}) };
}

export async function saveSettings(patch: Partial<IgSettings>) {
  const cur = await getSettings();
  const next: IgSettings = { ...cur };
  for (const k of ["handle", "whatsapp", "catalogUrl", "bookingUrl", "playbook"] as const)
    if (typeof patch[k] === "string") next[k] = (patch[k] as string).slice(0, 8000);
  if (Array.isArray(patch.rules))
    next.rules = patch.rules.slice(0, 30).map((r) => ({
      id: String(r.id || newId("rule")),
      keywords: (r.keywords ?? []).map((k) => String(k).trim()).filter(Boolean).slice(0, 30),
      reply: String(r.reply ?? "").slice(0, 1000),
      dm: String(r.dm ?? "").slice(0, 1000), // Instagram DM limit is 1000 chars
      active: Boolean(r.active),
    }));
  if (Array.isArray(patch.slots))
    next.slots = patch.slots
      .filter((s) => s.day >= 0 && s.day <= 6 && /^\d\d:\d\d$/.test(s.time))
      .map((s) => ({ day: s.day, time: s.time, format: s.format === "carousel" ? "carousel" : "reel" }));
  await mutate<SettingsRow, void>("settings", (rows) => {
    const r = rows.find((x) => x.id === "instagram");
    if (r) r.value = next;
    else rows.push({ id: "instagram", value: next });
  });
  return next;
}

// ---------- Scheduler: 7 posts for the next 7 days ----------
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

export async function listPosts() {
  return (await all<ScheduledPost>("posts")).sort((a, b) => a.at.localeCompare(b.at));
}

export async function planWeek() {
  const s = await getSettings();
  const start = addDays(dubaiDate(), 1);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const existing = await listPosts();
  const ideas = await all<Idea>("ideas");
  const used = new Set(existing.map((p) => p.ideaId));
  const taken = new Set(existing.map((p) => p.at.slice(0, 10)));

  // Pool: approved first, then new; never archived/posted/already scheduled.
  const pool = ideas
    .filter((i) => (i.status === "approved" || i.status === "new") && !used.has(i.id))
    .sort((a, b) => (a.status === b.status ? b.date.localeCompare(a.date) : a.status === "approved" ? -1 : 1));

  const free = days.filter((d) => !taken.has(d) && s.slots.some((sl) => sl.day === weekday(d)));
  // Top up with engine ideas if the pool is short (saved as "new" so you review them).
  let salt = 1;
  const fresh: Idea[] = [];
  while (pool.length + fresh.length < free.length && salt < 20) {
    for (const d of generateDailyIdeas(addDays(start, salt), salt)) fresh.push(toIdea(d, dubaiDate(), "engine"));
    salt++;
  }
  if (fresh.length) await mutate<Idea, void>("ideas", (rows) => void rows.push(...fresh));
  const all7 = [...pool, ...fresh];

  const created: ScheduledPost[] = [];
  let lastPillar = "";
  for (const d of free) {
    const slot = s.slots.find((sl) => sl.day === weekday(d))!;
    // rotate pillars: avoid two days in a row from the same pillar when possible
    let k = all7.findIndex((i) => i.pillar !== lastPillar);
    if (k < 0) k = 0;
    const idea = all7.splice(k, 1)[0];
    if (!idea) break;
    lastPillar = idea.pillar;
    created.push({
      id: newId("post"),
      ideaId: idea.id,
      title: idea.title,
      pillar: idea.pillar,
      format: slot.format,
      at: new Date(`${d}T${slot.time}:00+04:00`).toISOString(),
      status: "planned",
      createdAt: now(),
    });
  }
  await mutate<ScheduledPost, void>("posts", (rows) => void rows.push(...created));
  if (created.length) await logActivity({ module: "instagram", kind: "schedule", text: `جدولة ${created.length} بوستات للأسبوع القادم` });
  return created;
}

export async function updatePost(id: string, patch: Partial<ScheduledPost>) {
  return mutate<ScheduledPost, ScheduledPost | null>("posts", (rows) => {
    const p = rows.find((r) => r.id === id);
    if (!p) return null;
    if (patch.status) p.status = patch.status;
    if (patch.at && !Number.isNaN(Date.parse(patch.at))) p.at = new Date(patch.at).toISOString();
    if (patch.format === "reel" || patch.format === "carousel") p.format = patch.format;
    return p;
  });
}

export async function deletePost(id: string) {
  return mutate<ScheduledPost, boolean>("posts", (rows) => {
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return false;
    rows.splice(i, 1);
    return true;
  });
}

// ---------- Metrics history ----------
export async function listMetrics() {
  return (await all<MetricSnapshot>("metrics")).sort((a, b) => a.date.localeCompare(b.date));
}

export async function addMetric(m: Record<string, unknown>) {
  const n = (k: string) => Math.max(0, Math.round(Number(m[k]) || 0));
  const date = typeof m.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(m.date) ? m.date : dubaiDate();
  const snap: MetricSnapshot = {
    id: newId("met"),
    date,
    followers: n("followers"),
    views: n("views"),
    reach: n("reach"),
    saves: n("saves"),
    shares: n("shares"),
    topReel: typeof m.topReel === "string" ? m.topReel.slice(0, 500) : undefined,
    topReelViews: m.topReelViews != null ? n("topReelViews") : undefined,
    note: typeof m.note === "string" ? m.note.slice(0, 1000) : undefined,
    createdAt: now(),
  };
  await mutate<MetricSnapshot, void>("metrics", (rows) => {
    const i = rows.findIndex((r) => r.date === date); // one snapshot per day: replace
    if (i >= 0) rows.splice(i, 1);
    rows.push(snap);
  });
  return snap;
}

// ---------- Instagram → CRM ----------
export async function leadFromInstagram(b: Record<string, unknown>) {
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim().slice(0, 2000) : "");
  const username = str("username").replace(/^@?/, "@");
  const message = str("message");
  const c = await createClient({
    name: str("name") || username,
    phone: str("phone") || undefined,
    email: str("email") || undefined,
    orderType: guessOrderType(`${message} ${str("orderType")}`),
    // The customer's stated budget is a note only — never the price. Only the owner sets prices.
    price: 0,
    status: "lead",
    source: "instagram",
    notes: [`انستقرام ${username}`, message, str("details"), Number(b.budget) > 0 ? `ميزانية ذكرها العميل: ${Math.round(Number(b.budget))}` : ""]
      .filter(Boolean)
      .join("\n"),
  });
  return c;
}
