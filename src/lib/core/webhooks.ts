/**
 * Webhook Manager. Order of operations for every provider:
 *   size limit → signature on the RAW body (constant-time) → idempotency (source, eventId) → enqueue → 200 fast.
 * Unsigned or wrongly signed requests are never stored and never processed.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { PrismaClient, Prisma } from '@prisma/client';
import { verifyWebhook as verifyShopify } from '../shopify/webhook';
import { resolveSecret } from './secrets';
import { getState, type IntegrationKey } from './integrations';
import { enqueue } from './jobs';
import { notify } from './notifications';

export const MAX_WEBHOOK_BYTES = 1_000_000;
type H = { get(name: string): string | null };

/** Meta signs the raw body with the app secret: X-Hub-Signature-256: sha256=<hex>. */
export function verifyMetaSignature(raw: string, header: string | null, appSecret: string): boolean {
  if (!header || !appSecret || !header.startsWith('sha256=')) return false;
  const given = header.slice(7);
  if (!/^[0-9a-f]{64}$/i.test(given)) return false;
  const expected = createHmac('sha256', appSecret).update(raw, 'utf8').digest();
  return timingSafeEqual(Buffer.from(given, 'hex'), expected);
}
const safeEq = (a: string, b: string) => { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

type SourceDef = {
  integration: IntegrationKey; secret: { name: string; env?: string };
  verify(raw: string, h: H, secret: string): boolean;
  eventId(raw: string, h: H): string; topic(raw: string, h: H): string | null;
};
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
export const SOURCES: Record<string, SourceDef> = {
  shopify: { integration: 'shopify', secret: { name: 'shopify.webhook_secret', env: 'SHOPIFY_WEBHOOK_SECRET' },
    verify: (raw, h, s) => verifyShopify(raw, h.get('x-shopify-hmac-sha256'), s),
    eventId: (raw, h) => h.get('x-shopify-webhook-id') || sha(raw), topic: (_r, h) => h.get('x-shopify-topic') },
  meta: { integration: 'meta_messaging', secret: { name: 'meta.app_secret', env: 'META_APP_SECRET' },
    verify: (raw, h, s) => verifyMetaSignature(raw, h.get('x-hub-signature-256'), s),
    eventId: (raw) => sha(raw), // Meta sends no delivery id: identical retried bodies are duplicates
    topic: (raw) => { try { const j = JSON.parse(raw); return [j.object, ...(j.entry?.[0]?.changes ?? []).map((c: { field?: string }) => c.field), j.entry?.[0]?.messaging ? 'messaging' : null].filter(Boolean).join(':') || null; } catch { return null; } } },
};

export type WebhookResult = { status: number; body: string; outcome: 'queued' | 'duplicate' | 'ignored' | 'rejected' | 'not_configured' | 'unknown_source' | 'too_large' };

export async function receiveWebhook(db: PrismaClient, source: string, raw: string, h: H): Promise<WebhookResult> {
  const def = SOURCES[source];
  if (!def) return { status: 404, body: 'not found', outcome: 'unknown_source' };
  if (Buffer.byteLength(raw) > MAX_WEBHOOK_BYTES) return { status: 413, body: 'too large', outcome: 'too_large' };
  const secret = await resolveSecret(db, def.secret.name, def.secret.env);
  if (!secret) return { status: 503, body: 'not configured', outcome: 'not_configured' };
  if (!def.verify(raw, h, secret)) {
    await notify(db, { level: 'warning', source: 'webhooks', title: `Rejected ${source} webhook: invalid signature`, dedupeKey: `webhook.badsig:${source}` });
    return { status: 401, body: 'invalid signature', outcome: 'rejected' };
  }
  let payload: Prisma.InputJsonValue;
  try { payload = JSON.parse(raw); } catch { return { status: 400, body: 'invalid json', outcome: 'rejected' }; }
  const eventId = def.eventId(raw, h).slice(0, 200); const topic = def.topic(raw, h)?.slice(0, 120) ?? null;
  let delivery;
  try { delivery = await db.webhookDelivery.create({ data: { source, eventId, topic, signatureValid: true, payload } }); }
  catch (e) { if ((e as { code?: string }).code === 'P2002') return { status: 200, body: 'duplicate', outcome: 'duplicate' }; throw e; }
  const st = await getState(db, def.integration);
  if (!st.enabled || st.mode === 'disabled') {
    await db.webhookDelivery.update({ where: { id: delivery.id }, data: { status: 'ignored' } });
    return { status: 200, body: 'ok', outcome: 'ignored' };   // 200 so the provider does not retry forever; the event is kept for audit
  }
  const job = await enqueue(db, `webhook.${source}`, { deliveryId: delivery.id }, { idempotencyKey: `wh:${delivery.id}` });
  await db.webhookDelivery.update({ where: { id: delivery.id }, data: { status: 'queued', jobId: job.id } });
  return { status: 200, body: 'ok', outcome: 'queued' };
}

/** Meta subscription handshake (GET ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…). */
export async function metaVerifyChallenge(db: PrismaClient, q: URLSearchParams): Promise<{ status: number; body: string }> {
  const token = await resolveSecret(db, 'meta.webhook_verify_token', 'META_WEBHOOK_VERIFY_TOKEN');
  const challenge = q.get('hub.challenge') ?? '';
  if (!token || q.get('hub.mode') !== 'subscribe' || !safeEq(q.get('hub.verify_token') ?? '', token) || !/^[A-Za-z0-9_-]{1,200}$/.test(challenge)) return { status: 403, body: 'forbidden' };
  return { status: 200, body: challenge };
}
