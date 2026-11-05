import { deletePost, updatePost } from "@/lib/instagram";
import { bad, body, json, type Ctx } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: Ctx<{ id: string }>) {
  const { id } = await ctx.params;
  const p = await updatePost(id, await body(req));
  return p ? json(p) : bad("غير موجود", 404);
}

export async function DELETE(_req: Request, ctx: Ctx<{ id: string }>) {
  const { id } = await ctx.params;
  return (await deletePost(id)) ? json({ ok: true }) : bad("غير موجود", 404);
}
