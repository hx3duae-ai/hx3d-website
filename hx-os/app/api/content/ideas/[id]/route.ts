import { deleteIdea, getIdea, updateIdea } from "@/lib/content";
import { IDEA_STATUS, type Idea, type IdeaStatus } from "@/lib/content-types";
import { buildCarousel, buildReel } from "@/lib/idea-engine";
import { logActivity } from "@/lib/db";
import { bad, body, json, type Ctx } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: Ctx<{ id: string }>) {
  const i = await getIdea((await params).id);
  return i ? json(i) : bad("not found", 404);
}

// PATCH: {status} | {carousel} | {reel} | {title,hook} | {action:"rebuild"}
export async function PATCH(req: Request, { params }: Ctx<{ id: string }>) {
  const { id } = await params;
  const b = await body(req);
  const cur = await getIdea(id);
  if (!cur) return bad("not found", 404);
  const patch: Partial<Idea> = {};
  if (typeof b.status === "string" && b.status in IDEA_STATUS) patch.status = b.status as IdeaStatus;
  for (const k of ["title", "hook", "angle", "audience"] as const) if (typeof b[k] === "string") patch[k] = b[k] as string;
  if (b.carousel && typeof b.carousel === "object") patch.carousel = b.carousel as Idea["carousel"];
  if (b.reel && typeof b.reel === "object") patch.reel = b.reel as Idea["reel"];
  if (b.action === "rebuild") {
    const merged = { ...cur, ...patch };
    const seed = `${id}#${Date.now()}`;
    patch.carousel = buildCarousel(merged, seed);
    patch.reel = buildReel(merged, seed);
  }
  const updated = await updateIdea(id, patch);
  if (patch.status && patch.status !== cur.status)
    await logActivity({ module: "content", kind: "status", text: `"${cur.title}" ← ${IDEA_STATUS[patch.status]}`, ref: id });
  return json(updated);
}

export async function DELETE(_: Request, { params }: Ctx<{ id: string }>) {
  return (await deleteIdea((await params).id)) ? json({ ok: true }) : bad("not found", 404);
}
