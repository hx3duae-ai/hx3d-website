import { addMetrics, funnel, listMetrics } from "@/lib/instagram";
import { body, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const [snapshots, f] = await Promise.all([listMetrics(), funnel()]);
  return json({ snapshots, funnel: f });
}

/** The Metrics agent posts a snapshot it pulled from OOTTO:
 *  { period, followers, views, reach, saves, shares, topReel: { title, url, views }, notes } */
export async function POST(req: Request) {
  return json(await addMetrics(await body(req)), 201);
}
