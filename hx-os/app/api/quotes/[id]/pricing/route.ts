import { AuthError, requireOwner } from "@/lib/auth";
import { body, guarded, json, type Ctx } from "@/lib/http";
import { getPricing, setPricing } from "@/lib/quotes";

export const dynamic = "force-dynamic";

// OWNER ONLY. Read the internal pricing record.
export async function GET(req: Request, { params }: Ctx<{ id: string }>) {
  return guarded(req, async () => {
    const actor = requireOwner(req);
    const p = await getPricing((await params).id, actor);
    if (!p) throw new AuthError(404, "لا يوجد تسعير بعد");
    return json(p);
  });
}

// OWNER ONLY. The owner enters / edits the amounts personally.
// Body: { lines: [{desc, qty, unit}], vatIncluded: boolean, validUntil?, customerNote?, internalNote? }
// Every edit is audited and returns the quote to "draft" (it must be re-approved before sending).
export async function PUT(req: Request, { params }: Ctx<{ id: string }>) {
  return guarded(req, async () => {
    const actor = requireOwner(req);
    return json(await setPricing((await params).id, await body(req), actor));
  });
}
