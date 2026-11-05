// Instagram module — HX OS is the brain + CRM, OOTTO (or Meta directly) is the hands.
//
// Flow for "comment سعر → catalog DM":
//   OOTTO agent / Meta webhook  ──POST──▶  handleInbound()
//        ├─ match keyword, classify intent
//        ├─ upsert the person as an Instagram lead in the CRM
//        ├─ if META_PAGE_TOKEN is set → send the DM now via the Graph API
//        └─ else → queue it (action=catalog_queued); the OOTTO agent picks the
//                   queue up with GET /api/instagram/events?action=catalog_queued,
//                   sends through OOTTO, then PATCHes the event to catalog_sent.
import { all, dubaiDate, logActivity, mutate, newId, now } from "./db";
import { guessOrderType } from "./crm";
import { ensureDate } from "./content";
import type { Client } from "./crm-types";
import type { Idea } from "./content-types";
import type { Pillar } from "./content-types";
import { DEFAULT_IG_SETTINGS, type IgEvent, type IgMetrics, type IgPost, type IgPostStatus, type IgSettings } from "./instagram-types";

export * from "./instagram-types";

// ---------------- settings ----------------
type SettingsRow = { id: string } & Record<string, unknown>;

export async function getSettings(): Promise<IgSettings> {
  const row = (await all<SettingsRow>("settings")).find((r) => r.id === "instagram");
  return { ...DEFAULT_IG_SETTINGS, ...(row as Partial<IgSettings> | undefined) };
}

export async function saveSettings(input: Record<string, unknown>): Promise<IgSettings> {
  const cur = await getSettings();
  const next: IgSettings = { ...cur };
  if (Array.isArray(input.keywords))
    next.keywords = [...new Set(input.keywords.map((k) => String(k).trim()).filter(Boolean))].slice(0, 40);
  for (const k of ["catalogMessage", "catalogUrl", "publicReply"] as const)
    if (typeof input[k] === "string") next[k] = (input[k] as string).slice(0, 2000);
  if (Array.isArray(input.slots) && input.slots.length === 7 && input.slots.every((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t))))
    next.slots = input.slots.map(String);
  await mutate<SettingsRow, void>("settings", (rows) => {
    const i = rows.findIndex((r) => r.id === "instagram");
    const row = { id: "instagram", ...next };
    if (i < 0) rows.push(row);
    else rows[i] = row;
  });
  return next;
}

// ---------------- keyword matching ----------------
/** Lowercase, strip Arabic diacritics/tatweel, unify alef/ya/ta-marbuta forms. */
export function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Returns the keyword found in text (whole word, or Arabic "ال"/"و"/"ب" prefix), or null. */
export function matchKeyword(text: string, keywords: string[]): string | null {
  const hay = ` ${normalize(text)} `;
  for (const kw of keywords) {
    const k = normalize(kw);
    if (!k) continue;
    if (hay.includes(` ${k} `)) return kw;
    if (/^\p{Script=Arabic}/u.test(k) && ["ال", "و", "ب", "وال", "بال"].some((p) => hay.includes(` ${p}${k} `))) return kw;
  }
  return null;
}

export function classify(text: string, matched: string | null): IgEvent["intent"] {
  if (matched) return "price";
  const t = normalize(text);
  if (/(ابي|ابغي|ابغا|اطلب|طلب|احتاج|ممكن تسوون|order|need|want|quote)/.test(t)) return "order";
  if (/[?؟]/.test(text) || /^(كيف|متي|وين|هل|شو|ايش|how|when|where|can|do you)/.test(t)) return "question";
  return "other";
}

export function renderCatalog(s: IgSettings, name?: string) {
  return s.catalogMessage
    .replaceAll("{name}", name ? name : "")
    .replaceAll("{catalog}", s.catalogUrl || "(أضف رابط الكتالوج من صفحة Instagram ← Comment to DM)")
    .replace(/ {2,}/g, " ");
}

// ---------------- CRM bridge ----------------
async function upsertLead(e: { igUserId?: string; username?: string; text: string; kind: IgEvent["kind"] }) {
  const handle = e.username?.replace(/^@/, "");
  if (!e.igUserId && !handle) return undefined;
  const res = await mutate<Client, { id: string; created: boolean; name: string }>("clients", (rows) => {
    const existing = rows.find(
      (r) => (e.igUserId && r.igUserId === e.igUserId) || (handle && r.igHandle?.toLowerCase() === handle.toLowerCase()),
    );
    const line = `📸 ${e.kind === "comment" ? "تعليق" : "رسالة"} (${dubaiDate()}): ${e.text.slice(0, 300)}`;
    if (existing) {
      existing.igUserId ||= e.igUserId;
      existing.igHandle ||= handle;
      if (existing.orderType === "other") existing.orderType = guessOrderType(e.text);
      existing.notes = existing.notes ? `${existing.notes}\n${line}` : line;
      existing.updatedAt = now();
      return { id: existing.id, created: false, name: existing.name };
    }
    const c: Client = {
      id: newId("cli"),
      name: handle ? `@${handle}` : "عميل انستقرام",
      igHandle: handle,
      igUserId: e.igUserId,
      orderType: guessOrderType(e.text),
      price: 0,
      status: "lead",
      source: "instagram",
      notes: line,
      createdAt: now(),
      updatedAt: now(),
    };
    rows.push(c);
    return { id: c.id, created: true, name: c.name };
  });
  if (res.created) await logActivity({ module: "crm", kind: "client_created", text: `ليد جديد من انستقرام: ${res.name}`, ref: res.id });
  return res.id;
}

// ---------------- Meta Graph API (optional direct sending) ----------------
const GRAPH = "https://graph.facebook.com/v21.0";
export const metaEnabled = () => Boolean(process.env.META_PAGE_TOKEN && process.env.IG_USER_ID);

async function graph(pathname: string, payload: Record<string, unknown>) {
  const r = await fetch(`${GRAPH}/${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.META_PAGE_TOKEN}` },
    body: JSON.stringify(payload),
  });
  const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!r.ok) throw new Error(j.error?.message || `Graph API ${r.status}`);
  return j;
}

/** Private reply to a comment (lands in their DMs) or a normal DM to an IG-scoped id. */
async function sendDm(to: { commentId?: string; igUserId?: string }, text: string) {
  const recipient = to.commentId ? { comment_id: to.commentId } : { id: to.igUserId };
  return graph(`${process.env.IG_USER_ID}/messages`, { recipient, message: { text } });
}

async function replyPublic(commentId: string, text: string) {
  return graph(`${commentId}/replies`, { message: text });
}

// ---------------- inbound ----------------
export type Inbound = {
  kind: IgEvent["kind"];
  externalId: string;
  text: string;
  igUserId?: string;
  username?: string;
  mediaId?: string;
  via?: IgEvent["via"];
};

/** Process one comment or DM. Idempotent on (kind, externalId). */
export async function handleInbound(input: Inbound) {
  const dup = (await all<IgEvent>("ig_events")).find((e) => e.kind === input.kind && e.externalId === input.externalId);
  if (dup) return { event: dup, duplicate: true };

  const s = await getSettings();
  const matched = matchKeyword(input.text, s.keywords);
  const intent = classify(input.text, matched);
  const clientId = intent === "other" && input.kind === "comment" ? undefined : await upsertLead(input);

  const ev: IgEvent = {
    id: newId("ige"),
    kind: input.kind,
    externalId: input.externalId,
    igUserId: input.igUserId,
    username: input.username?.replace(/^@/, ""),
    text: input.text.slice(0, 2000),
    mediaId: input.mediaId,
    matched: matched ?? undefined,
    intent,
    clientId,
    action: matched ? "catalog_queued" : intent === "other" && input.kind === "comment" ? "ignored" : "needs_reply",
    via: input.via ?? "manual",
    at: now(),
  };

  if (matched) {
    ev.reply = renderCatalog(s, ev.username ? `@${ev.username}` : undefined);
    if (metaEnabled()) {
      try {
        await sendDm(input.kind === "comment" ? { commentId: input.externalId } : { igUserId: input.igUserId }, ev.reply);
        if (input.kind === "comment" && s.publicReply) await replyPublic(input.externalId, s.publicReply).catch(() => undefined);
        ev.action = "catalog_sent";
      } catch (e) {
        ev.error = (e as Error).message;
      }
    }
  }

  await mutate<IgEvent, void>("ig_events", (rows) => {
    rows.unshift(ev);
    if (rows.length > 5000) rows.length = 5000;
  });
  if (matched)
    await logActivity({
      module: "instagram",
      kind: ev.action,
      text: `${ev.action === "catalog_sent" ? "✓ أُرسل" : "⏳ بانتظار الإرسال:"} كتالوج لـ @${ev.username ?? "?"} (كتب «${matched}»)`,
      ref: ev.id,
    });
  return { event: ev, duplicate: false };
}

export async function listEvents(filter?: { action?: string; kind?: string; limit?: number }) {
  let rows = await all<IgEvent>("ig_events");
  if (filter?.action) rows = rows.filter((e) => e.action === filter.action);
  if (filter?.kind) rows = rows.filter((e) => e.kind === filter.kind);
  return rows.slice(0, Math.min(500, filter?.limit ?? 200));
}

const ACTIONS: IgEvent["action"][] = ["catalog_sent", "catalog_queued", "needs_reply", "replied", "ignored"];

export async function updateEvent(id: string, patch: Record<string, unknown>) {
  return mutate<IgEvent, IgEvent | null>("ig_events", (rows) => {
    const e = rows.find((r) => r.id === id);
    if (!e) return null;
    if (ACTIONS.includes(patch.action as IgEvent["action"])) e.action = patch.action as IgEvent["action"];
    if (typeof patch.reply === "string") e.reply = patch.reply.slice(0, 2000);
    if (typeof patch.error === "string") e.error = patch.error.slice(0, 500);
    if (e.action === "catalog_sent" || e.action === "replied") delete e.error;
    return e;
  });
}

// ---------------- scheduler: 7 posts a week ----------------
const PILLAR_ORDER: Pillar[] = ["gifts", "architecture", "products"];
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

export async function listPosts(from?: string) {
  const rows = await all<IgPost>("ig_posts");
  return rows.filter((p) => !from || p.date >= from).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

/** Fill the 7 days starting at `start` (default: today, Dubai). Days that already have a post are kept. */
export async function planWeek(start = dubaiDate()) {
  const s = await getSettings();
  const existing = await all<IgPost>("ig_posts");
  const days = Array.from({ length: 7 }, (_, d) => addDays(start, d)).filter(
    (date) => !existing.some((p) => p.date === date && p.status !== "skipped"),
  );
  // Every open day gets its own fresh ideas in Content OS (Claude, or the offline engine).
  for (const date of days) await ensureDate(date);

  const usedIdeas = new Set(existing.map((p) => p.ideaId).filter(Boolean));
  const pool = (await all<Idea>("ideas")).filter((i) => (i.status === "approved" || i.status === "new") && !usedIdeas.has(i.id));
  const take = (pred: (i: Idea) => boolean) => {
    const k = pool.findIndex(pred);
    return k >= 0 ? pool.splice(k, 1)[0] : undefined;
  };

  const created: IgPost[] = [];
  days.forEach((date, d) => {
    const pillar = PILLAR_ORDER[d % 3];
    // Approved ideas first (you already said yes to them), then that day's own ideas.
    const idea =
      take((i) => i.status === "approved" && i.pillar === pillar) ??
      take((i) => i.date === date && i.pillar === pillar) ??
      take((i) => i.date === date) ??
      take(() => true);
    const format: IgPost["format"] = d % 2 === 0 ? "reel" : "carousel"; // 4 reels + 3 carousels on a full week
    const caption = idea?.carousel
      ? `${idea.carousel.caption}\n\n${idea.carousel.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`
      : "";
    created.push({
      id: newId("igp"),
      date,
      time: s.slots[weekday(date)],
      format,
      pillar: idea?.pillar ?? pillar,
      ideaId: idea?.id,
      title: idea?.title ?? "خانة فاضية — ولّد أفكار جديدة في Content OS",
      caption,
      status: idea?.render?.status === "done" ? "ready" : "planned",
      createdAt: now(),
      updatedAt: now(),
    });
  });
  if (created.length) {
    await mutate<IgPost, void>("ig_posts", (rows) => void rows.push(...created));
    await logActivity({ module: "instagram", kind: "plan", text: `جدول انستقرام: ${created.length} بوست جديد من ${start}` });
  }
  return created;
}

const POST_STATUS: IgPostStatus[] = ["planned", "ready", "scheduled", "posted", "skipped"];

export async function updatePost(id: string, patch: Record<string, unknown>) {
  const res = await mutate<IgPost, IgPost | null>("ig_posts", (rows) => {
    const p = rows.find((r) => r.id === id);
    if (!p) return null;
    if (POST_STATUS.includes(patch.status as IgPostStatus)) p.status = patch.status as IgPostStatus;
    if (typeof patch.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(patch.time)) p.time = patch.time;
    if (typeof patch.caption === "string") p.caption = patch.caption.slice(0, 2200); // IG caption limit
    if (typeof patch.externalId === "string") p.externalId = patch.externalId.slice(0, 200);
    p.updatedAt = now();
    return p;
  });
  // Keep Content OS in sync: a posted IG post marks its idea as posted.
  if (res?.status === "posted" && res.ideaId)
    await mutate<Idea, void>("ideas", (rows) => {
      const i = rows.find((r) => r.id === res.ideaId);
      if (i) i.status = "posted";
    });
  return res;
}

export async function deletePost(id: string) {
  return mutate<IgPost, boolean>("ig_posts", (rows) => {
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return false;
    rows.splice(i, 1);
    return true;
  });
}

// ---------------- metrics snapshots ----------------
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : undefined);

export async function addMetrics(input: Record<string, unknown>) {
  const top = (input.topReel ?? {}) as Record<string, unknown>;
  const m: IgMetrics = {
    id: newId("igm"),
    at: now(),
    period: typeof input.period === "string" ? input.period.slice(0, 40) : "last_7d",
    followers: num(input.followers),
    views: num(input.views),
    reach: num(input.reach),
    saves: num(input.saves),
    shares: num(input.shares),
    topReel:
      top && (top.title || top.url || top.id)
        ? { id: top.id ? String(top.id) : undefined, title: top.title ? String(top.title).slice(0, 200) : undefined, url: top.url ? String(top.url) : undefined, views: num(top.views) }
        : undefined,
    notes: typeof input.notes === "string" ? input.notes.slice(0, 4000) : undefined,
    source: input.source === "meta" || input.source === "manual" ? input.source : "ootto",
  };
  await mutate<IgMetrics, void>("ig_metrics", (rows) => {
    rows.unshift(m);
    if (rows.length > 1000) rows.length = 1000;
  });
  return m;
}

export async function listMetrics() {
  return all<IgMetrics>("ig_metrics");
}

/** Conversion funnel the Metrics agent can reason about: comments → catalog → leads → delivered sales. */
export async function funnel() {
  const [events, clients] = await Promise.all([all<IgEvent>("ig_events"), all<Client>("clients")]);
  const ig = clients.filter((c) => c.source === "instagram");
  return {
    comments: events.filter((e) => e.kind === "comment").length,
    dms: events.filter((e) => e.kind === "dm").length,
    catalogSent: events.filter((e) => e.action === "catalog_sent").length,
    catalogQueued: events.filter((e) => e.action === "catalog_queued").length,
    needsReply: events.filter((e) => e.action === "needs_reply").length,
    leads: ig.length,
    inProgress: ig.filter((c) => c.status === "in_progress").length,
    delivered: ig.filter((c) => c.status === "delivered").length,
    revenue: ig.filter((c) => c.status === "delivered").reduce((a, c) => a + c.price, 0),
  };
}
