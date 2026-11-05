import { updateEvent } from "@/lib/instagram";
import { bad, body, json, type Ctx } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Mark an event handled: { action: "catalog_sent" | "replied" | "ignored", reply?, error? } */
export async function PATCH(req: Request, ctx: Ctx<{ id: string }>) {
  const { id } = await ctx.params;
  const e = await updateEvent(id, await body(req));
  return e ? json(e) : bad("غير موجود", 404);
}
