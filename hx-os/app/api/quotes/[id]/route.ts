import { AuthError, isOwner, requireRole } from "@/lib/auth";
import { body, guarded, json, type Ctx } from "@/lib/http";
import { canSee, getPricing, getQuote, publicQuote, updateQuote } from "@/lib/quotes";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: Ctx<{ id: string }>) {
  return guarded(req, async () => {
    const actor = requireRole(req, ["owner", "employee", "agent"]);
    const q = await getQuote((await params).id);
    if (!q || !canSee(actor, q)) throw new AuthError(404, "not found");
    // pricing is attached ONLY for the owner
    return json({ ...publicQuote(q), ...(isOwner(actor) ? { pricing: await getPricing(q.id, actor) } : {}) });
  });
}

// Update request details / workflow status / (owner) assignment. Price fields → 403.
export async function PATCH(req: Request, { params }: Ctx<{ id: string }>) {
  return guarded(req, async () => {
    const actor = requireRole(req, ["owner", "employee", "agent"]);
    return json(publicQuote(await updateQuote((await params).id, await body(req), actor)));
  });
}
