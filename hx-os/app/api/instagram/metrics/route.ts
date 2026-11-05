import { addMetric, listMetrics } from "@/lib/instagram";
import { body, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return json(await listMetrics());
}

// POST a snapshot (typed in, or pasted from OOTTO/Instagram insights by Claude).
export async function POST(req: Request) {
  return json(await addMetric(await body(req)), 201);
}
