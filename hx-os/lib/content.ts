import { all, dubaiDate, logActivity, mutate, newId, now } from "./db";
import type { Idea } from "./content-types";
import { buildCarousel, buildReel, generateDailyIdeas, occasionsFor, type DraftIdea } from "./idea-engine";
import { claudeEnabled, generateWithClaude, type FullIdea } from "./claude";
import type { Client } from "./crm";
import { ORDER_TYPES } from "./crm";

export async function listIdeas() {
  const rows = await all<Idea>("ideas");
  return rows.sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : b.date.localeCompare(a.date)));
}

async function draft(date: string, salt: number): Promise<{ ideas: (DraftIdea & Partial<FullIdea>)[]; source: Idea["source"]; note?: string }> {
  if (claudeEnabled()) {
    try {
      const recent = (await all<Idea>("ideas")).slice(-30).map((i) => i.title);
      const ideas = await generateWithClaude({ date, occasions: occasionsFor(date).map((o) => o.name), avoidTitles: recent });
      if (ideas.length === 3) return { ideas, source: "claude" };
    } catch (e) {
      return { ideas: generateDailyIdeas(date, salt), source: "engine", note: `Claude غير متاح، استخدمنا المحرك المحلي: ${(e as Error).message}` };
    }
  }
  return { ideas: generateDailyIdeas(date, salt), source: "engine" };
}

function toIdea(d: DraftIdea & Partial<FullIdea>, date: string, source: Idea["source"]): Idea {
  const id = newId("idea");
  return {
    id,
    date,
    pillar: d.pillar,
    title: d.title,
    angle: d.angle,
    hook: d.hook,
    audience: d.audience,
    occasion: d.occasion,
    status: "new",
    source,
    // Auto-convert every idea into a carousel + reel script right away.
    carousel: d.carousel ?? buildCarousel(d, id),
    reel: d.reel ?? buildReel(d, id),
    createdAt: now(),
  };
}

/** Make sure today's 3 ideas exist. Idempotent. */
export async function ensureToday() {
  const date = dubaiDate();
  const existing = (await all<Idea>("ideas")).filter((i) => i.date === date && i.source !== "crm");
  if (existing.length >= 3) return { created: 0 };
  const { ideas, source, note } = await draft(date, 0);
  const made = await mutate<Idea, number>("ideas", (rows) => {
    // re-check inside the lock (two tabs opening at once)
    if (rows.some((i) => i.date === date && i.source !== "crm")) return 0;
    for (const d of ideas) rows.push(toIdea(d, date, source));
    return ideas.length;
  });
  if (made) await logActivity({ module: "content", kind: "daily", text: `توليد ${made} أفكار ليوم ${date}` });
  return { created: made, note };
}

/** Replace today's untouched ("new") ideas with a fresh set. */
export async function regenerateToday() {
  const date = dubaiDate();
  const salt = Date.now() % 100000;
  const { ideas, source, note } = await draft(date, salt);
  await mutate<Idea, void>("ideas", (rows) => {
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      if (r.date === date && r.status === "new" && r.source !== "crm") rows.splice(i, 1);
    }
    for (const d of ideas) rows.push(toIdea(d, date, source));
  });
  await logActivity({ module: "content", kind: "regenerate", text: `إعادة توليد أفكار ${date}` });
  return { note };
}

export async function updateIdea(id: string, patch: Partial<Idea>) {
  return mutate<Idea, Idea | null>("ideas", (rows) => {
    const i = rows.find((r) => r.id === id);
    if (!i) return null;
    Object.assign(i, patch, { id: i.id, createdAt: i.createdAt });
    return i;
  });
}

export async function getIdea(id: string) {
  return (await all<Idea>("ideas")).find((i) => i.id === id) ?? null;
}

export async function deleteIdea(id: string) {
  return mutate<Idea, boolean>("ideas", (rows) => {
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return false;
    rows.splice(i, 1);
    return true;
  });
}

/** CRM → Content: turn a delivered order into a case-study post. */
export async function ideaFromClient(c: Client) {
  const pillar = ORDER_TYPES[c.orderType].pillar;
  const d: DraftIdea = {
    pillar,
    title: `قصة عميل: ${ORDER_TYPES[c.orderType].label}${c.company ? ` لـ ${c.company}` : ""}`,
    angle: "قصة عميل",
    hook: "عميل جانا بفكرة… وطلع بهذا 👀",
    audience: c.company ? `شركات مثل ${c.company}` : "عملاء جدد",
  };
  const idea = toIdea(d, dubaiDate(), "crm");
  idea.clientId = c.id;
  await mutate<Idea, void>("ideas", (rows) => void rows.push(idea));
  await logActivity({ module: "content", kind: "case_study", text: `فكرة محتوى من طلب ${c.name}`, ref: idea.id });
  return idea;
}
