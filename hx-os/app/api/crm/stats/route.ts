import { listClients, monthlyStats } from "@/lib/crm";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return json(monthlyStats(await listClients()));
}
