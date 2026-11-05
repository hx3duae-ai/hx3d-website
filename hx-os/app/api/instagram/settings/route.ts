import { getSettings, saveSettings } from "@/lib/instagram";
import { body, json } from "@/lib/http";
import type { IgSettings } from "@/lib/instagram-types";

export const dynamic = "force-dynamic";

export async function GET() {
  return json(await getSettings());
}

export async function PUT(req: Request) {
  return json(await saveSettings((await body(req)) as Partial<IgSettings>));
}
