import { deletePost, updatePost } from "@/lib/instagram";
import { POST_STATUS, type ScheduledPost } from "@/lib/instagram-types";
import { bad, body, json, type Ctx } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: Ctx<{ id: string }>) {
  const b = await body(req);
  const patch: Partial<ScheduledPost> = {};
  if (typeof b.status === "string" && b.status in POST_STATUS) patch.status = b.status as ScheduledPost["status"];
  if (typeof b.at === "string") patch.at = b.at;
  if (b.format === "reel" || b.format === "carousel") patch.format = b.format;
  const p = await updatePost((await params).id, patch);
  return p ? json(p) : bad("not found", 404);
}

export async function DELETE(_: Request, { params }: Ctx<{ id: string }>) {
  return (await deletePost((await params).id)) ? json({ ok: true }) : bad("not found", 404);
}
