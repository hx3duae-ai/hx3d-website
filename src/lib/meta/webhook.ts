import { createHmac, timingSafeEqual } from 'node:crypto';

/** X-Hub-Signature-256 is "sha256=" + HMAC-SHA256(app secret, raw body). Checked before anything is read. */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !appSecret || !header.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest();
  let given: Buffer;
  try { given = Buffer.from(header.slice(7), 'hex'); } catch { return false; }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Subscription handshake (GET): echo the challenge only when the verify token matches. */
export function verifySubscription(params: URLSearchParams, verifyToken: string): string | null {
  if (!verifyToken) return null;
  const mode = params.get('hub.mode'), token = params.get('hub.verify_token') ?? '', challenge = params.get('hub.challenge');
  if (mode !== 'subscribe' || !challenge) return null;
  const a = Buffer.from(token), b = Buffer.from(verifyToken);
  return a.length === b.length && timingSafeEqual(a, b) ? challenge : null;
}

export type InboundEvent = { channel: 'instagram_dm' | 'instagram_comment'; senderRef: string; text: string; mid: string };

/** Extracts only text DMs and comments. Other event types are ignored. */
export function parseInbound(payload: unknown): InboundEvent[] {
  const out: InboundEvent[] = [];
  const p = payload as { object?: string; entry?: Array<{ messaging?: unknown[]; changes?: unknown[] }> };
  if (p?.object !== 'instagram') return out;
  for (const e of p.entry ?? []) {
    for (const m of (e.messaging ?? []) as Array<{ sender?: { id?: string }; message?: { mid?: string; text?: string; is_echo?: boolean } }>) {
      if (m.message?.text && m.message.mid && !m.message.is_echo && m.sender?.id)
        out.push({ channel: 'instagram_dm', senderRef: m.sender.id, text: m.message.text, mid: m.message.mid });
    }
    for (const c of (e.changes ?? []) as Array<{ field?: string; value?: { id?: string; text?: string; from?: { id?: string } } }>) {
      if (c.field === 'comments' && c.value?.text && c.value.id && c.value.from?.id)
        out.push({ channel: 'instagram_comment', senderRef: c.value.from.id, text: c.value.text, mid: c.value.id });
    }
  }
  return out;
}
