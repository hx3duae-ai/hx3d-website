import { handleWebhook, verifySignature } from "@/lib/calcom";
import { bad, json } from "@/lib/http";

export const dynamic = "force-dynamic";

// Cal.com → Settings → Developer → Webhooks → Subscriber URL: https://<your-host>/api/webhooks/calcom
// Events: Booking Created, Booking Rescheduled, Booking Cancelled. Same secret as CAL_WEBHOOK_SECRET.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-cal-signature-256"))) return bad("bad signature", 401);
  let b: Record<string, unknown>;
  try {
    b = JSON.parse(raw);
  } catch {
    return bad("invalid json");
  }
  return json({ result: await handleWebhook(b) });
}
