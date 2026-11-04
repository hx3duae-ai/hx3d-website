/** Core job handlers. Each system adds its own handlers in its phase (e.g. social.* in phase 4). */
import type { PrismaClient } from '@prisma/client';
import type { Handlers } from './jobs';
import { integrationKeys } from './integrations';
import { runHealthChecks } from './health';
import { HxError } from './errors';

async function markDelivery(db: PrismaClient, payload: unknown, note: string) {
  const id = (payload as { deliveryId?: string })?.deliveryId; if (!id) throw new HxError('invalid_input', 'deliveryId missing');
  await db.webhookDelivery.update({ where: { id }, data: { status: 'processed', error: null } });
  return { deliveryId: id, note };
}

export const coreHandlers: Handlers = {
  // Stored and acknowledged. Business processing is added by the owning system (Shopify sync / Social Automation).
  'webhook.shopify': (p, { db }) => markDelivery(db, p, 'stored; no consumer yet (Shopify sync arrives with the Shopify connection phase)'),
  'webhook.meta': (p, { db }) => markDelivery(db, p, 'stored; no consumer yet (Social Automation, phase 4)'),
  'core.health': async (_p, { db }) => {
    const r = await runHealthChecks(db, integrationKeys);
    return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.status]));
  },
};
