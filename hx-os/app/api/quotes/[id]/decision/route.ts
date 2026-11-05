import { AuthError, requireOwner } from "@/lib/auth";
import { body, guarded, json, type Ctx } from "@/lib/http";
import { decide } from "@/lib/quotes";

export const dynamic = "force-dynamic";

// OWNER ONLY. Body: { decision: "approved" | "rejected", reason? }
export async function POST(req: Request, { params }: Ctx<{ id: string }>) {
  return guarded(req, async () => {
    const actor = requireOwner(req);
    const b = await body(req);
    if (b.decision !== "approved" && b.decision !== "rejected") throw new AuthError(400, "decision must be approved | rejected");
    return json(await decide((await params).id, b.decision, actor, typeof b.reason === "string" ? b.reason : undefined));
  });
}
