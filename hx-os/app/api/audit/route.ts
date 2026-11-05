import { requireOwner } from "@/lib/auth";
import { auditFor } from "@/lib/audit";
import { guarded, json } from "@/lib/http";

export const dynamic = "force-dynamic";

// OWNER ONLY. Full audit log (pricing changes, approvals, sends, denied attempts).
export async function GET(req: Request) {
  return guarded(req, async () => {
    requireOwner(req);
    return json((await auditFor()).slice(0, 1000));
  });
}
