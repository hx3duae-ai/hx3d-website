import { handleMetaWebhook, verifyMetaSignature } from "@/lib/meta";

export const dynamic = "force-dynamic";

/** Meta subscription handshake: echo hub.challenge when the verify token matches. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const token = process.env.META_VERIFY_TOKEN;
  if (u.searchParams.get("hub.mode") === "subscribe" && token && u.searchParams.get("hub.verify_token") === token)
    return new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("bad signature", { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const results = await handleMetaWebhook(body);
  // Always 200 quickly so Meta doesn't retry; failures are recorded on each event.
  return Response.json({ processed: results.length });
}
