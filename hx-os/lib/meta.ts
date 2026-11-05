// Direct Meta (Instagram Graph API) webhook — optional fallback next to OOTTO.
// Subscribe the app to the "comments" and "messages" fields of your IG account
// and point it at  GET/POST /api/webhooks/meta  (needs a public URL).
import crypto from "node:crypto";
import { handleInbound, type Inbound } from "./instagram";

export function verifyMetaSignature(raw: string, header: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // local testing only
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(crypto.createHmac("sha256", secret).update(raw).digest("hex"));
  const got = Buffer.from(header.slice(7));
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}

type Entry = {
  changes?: { field?: string; value?: Record<string, unknown> }[];
  messaging?: { sender?: { id?: string }; message?: { mid?: string; text?: string; is_echo?: boolean } }[];
};

export function parseMetaWebhook(body: Record<string, unknown>): Inbound[] {
  if (body.object !== "instagram") return [];
  const me = process.env.IG_USER_ID;
  const out: Inbound[] = [];
  for (const entry of (body.entry as Entry[] | undefined) ?? []) {
    for (const ch of entry.changes ?? []) {
      if (ch.field !== "comments" || !ch.value) continue;
      const v = ch.value as { id?: string; text?: string; from?: { id?: string; username?: string }; media?: { id?: string } };
      if (!v.id || !v.text || (me && v.from?.id === me)) continue; // skip our own replies
      out.push({ kind: "comment", externalId: v.id, text: v.text, igUserId: v.from?.id, username: v.from?.username, mediaId: v.media?.id, via: "meta" });
    }
    for (const m of entry.messaging ?? []) {
      if (!m.message?.mid || !m.message.text || m.message.is_echo || (me && m.sender?.id === me)) continue;
      out.push({ kind: "dm", externalId: m.message.mid, text: m.message.text, igUserId: m.sender?.id, via: "meta" });
    }
  }
  return out;
}

export async function handleMetaWebhook(body: Record<string, unknown>) {
  const items = parseMetaWebhook(body);
  const results = [];
  for (const i of items) results.push(await handleInbound(i));
  return results;
}
