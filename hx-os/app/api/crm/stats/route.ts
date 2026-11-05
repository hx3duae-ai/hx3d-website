import { getActor, isOwner } from "@/lib/auth";
import { listClients, monthlyStats } from "@/lib/crm";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

// Money figures are owner-only; everyone else gets counts with amounts zeroed and restricted: true.
export async function GET(req: Request) {
  const s = monthlyStats(await listClients());
  if (isOwner(getActor(req))) return json({ ...s, restricted: false });
  const z = (m: (typeof s.months)[number]) => ({ ...m, sales: 0 });
  return json({ ...s, months: s.months.map(z), current: z(s.current), previous: z(s.previous), pipeline: 0, restricted: true });
}
