import { syncFromApi } from "@/lib/calcom";
import { bad, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return json({ apiKey: Boolean(process.env.CAL_API_KEY), webhookSecret: Boolean(process.env.CAL_WEBHOOK_SECRET) });
}

export async function POST() {
  try {
    return json(await syncFromApi());
  } catch (e) {
    return bad((e as Error).message, 502);
  }
}
