import { funnel, listEvents } from "@/lib/instagram";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

/** ?action=catalog_queued  → the queue the OOTTO agent should send. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const [events, f] = await Promise.all([
    listEvents({ action: u.searchParams.get("action") ?? undefined, kind: u.searchParams.get("kind") ?? undefined, limit: Number(u.searchParams.get("limit")) || undefined }),
    funnel(),
  ]);
  return json({ events, funnel: f });
}
