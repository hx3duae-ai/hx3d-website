import { getSettings, metaEnabled, saveSettings } from "@/lib/instagram";
import { body, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return json({ ...(await getSettings()), meta: metaEnabled(), metaWebhook: Boolean(process.env.META_VERIFY_TOKEN) });
}

export async function PUT(req: Request) {
  return json(await saveSettings(await body(req)));
}
