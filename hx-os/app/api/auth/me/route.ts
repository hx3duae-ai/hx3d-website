import { getActor, ownerConfigured } from "@/lib/auth";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = getActor(req);
  return json({ role: a.role, id: a.id, ownerConfigured: ownerConfigured() });
}
