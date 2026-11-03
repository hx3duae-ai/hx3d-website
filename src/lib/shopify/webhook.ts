import { createHmac, timingSafeEqual } from 'node:crypto';

/** Verifies X-Shopify-Hmac-Sha256 against the raw request body. Must run before any processing. */
export function verifyWebhook(rawBody: string, hmacHeader: string | null, secret: string): boolean {
  if (!hmacHeader || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  let given: Buffer;
  try { given = Buffer.from(hmacHeader, 'base64'); } catch { return false; }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

type ClaimDb = { webhookEvent: { create: (a: { data: { id: string; topic: string } }) => Promise<unknown> } };

/** Idempotency: X-Shopify-Webhook-Id is the primary key. A second delivery of the same event is a duplicate. */
export async function claimWebhook(db: ClaimDb, webhookId: string, topic: string): Promise<'new' | 'duplicate'> {
  try {
    await db.webhookEvent.create({ data: { id: webhookId, topic } });
    return 'new';
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') return 'duplicate';
    throw e;
  }
}
