import { leadFromInstagram } from "@/lib/instagram";
import { bad, body, json } from "@/lib/http";

export const dynamic = "force-dynamic";

// Instagram DM / comment → CRM lead.
// Body: { username, name?, message, phone?, email?, orderType?, budget?, details? }
// If HX_INBOUND_TOKEN is set, send it as header x-hx-token (required once the app is exposed).
export async function POST(req: Request) {
  const token = process.env.HX_INBOUND_TOKEN;
  if (token && req.headers.get("x-hx-token") !== token) return bad("unauthorized", 401);
  const b = await body(req);
  if (typeof b.username !== "string" || !b.username.trim()) return bad("username مطلوب");
  return json(await leadFromInstagram(b), 201);
}
