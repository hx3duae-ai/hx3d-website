import { requireOwner } from "@/lib/auth";
import { auditFor } from "@/lib/audit";
import { guarded, json, type Ctx } from "@/lib/http";

export const dynamic = "force-dynamic";

// OWNER ONLY. Audit trail for one quotation.
export async function GET(req: Request, { params }: Ctx<{ id: string }>) {
  return guarded(req, async () => {
    requireOwner(req);
    return json(await auditFor((await params).id));
  });
}
