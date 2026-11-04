/**
 * HX Command Center data. Read-only aggregation over the shared database.
 * A number is only shown when its source exists and is connected; otherwise the field is null and the UI says why.
 */
import type { PrismaClient } from '@prisma/client';
import { allStates, killSwitchOn } from './integrations';
import { queueStats } from './jobs';
import { counts as notificationCounts, listOpen } from './notifications';
import { dbHealth } from './health';

const DAY = 86_400_000;
/** Which systems exist yet. Updated as each phase lands (no system is reported as working before it is built and tested). */
export const SYSTEMS = [
  { key: 'core', built: true }, { key: 'najm', built: false, phase: 3 }, { key: 'social', built: false, phase: 4 },
  { key: 'marketing', built: false, phase: 5 }, { key: 'reels', built: false, phase: 6 },
] as const;

export async function commandCenter(db: PrismaClient, now = new Date()) {
  const d7 = new Date(now.getTime() - 7 * DAY); const d30 = new Date(now.getTime() - 30 * DAY);
  const [contactsTotal, contacts7, byChannel, customers, files30, filesTotal, downloads, topVideos, orders30, sales30, states, kill, jobs, notes, open, db_, badHooks] = await Promise.all([
    db.contact.count(),
    db.contact.count({ where: { firstSeenAt: { gte: d7 } } }),
    db.contactIdentity.groupBy({ by: ['channel'], _count: { _all: true } }),
    db.user.count({ where: { role: 'CUSTOMER' } }),
    db.activityEvent.count({ where: { type: 'file.sent', createdAt: { gte: d30 } } }),
    db.activityEvent.count({ where: { type: 'file.sent' } }),
    db.downloadGrant.aggregate({ _sum: { downloads: true } }),
    db.activityEvent.groupBy({ by: ['videoId'], where: { videoId: { not: null }, type: { in: ['contact.new', 'file.sent', 'order.created'] }, createdAt: { gte: d30 } }, _count: { _all: true }, orderBy: { _count: { videoId: 'desc' } }, take: 5 }),
    db.activityEvent.count({ where: { system: 'shop', type: 'order.created', createdAt: { gte: d30 } } }),
    db.activityEvent.aggregate({ where: { system: 'shop', type: 'order.created', createdAt: { gte: d30 } }, _sum: { amount: true } }),
    allStates(db), killSwitchOn(db), queueStats(db), notificationCounts(db), listOpen(db, 10), dbHealth(db),
    db.webhookDelivery.count({ where: { status: 'rejected', receivedAt: { gte: new Date(now.getTime() - DAY) } } }),
  ]);
  const st = (k: string) => states.find((s) => s.key === k);
  const shopOk = st('shopify')?.status === 'ok'; const adsOk = st('meta_ads')?.status === 'ok';
  return {
    generatedAt: now,
    contacts: { total: contactsTotal, new7d: contacts7, byChannel: byChannel.map((c) => ({ channel: c.channel, count: c._count._all })), registeredCustomers: customers },
    files: { sent30d: files30, sentTotal: filesTotal, downloads: downloads._sum.downloads ?? 0 },
    topVideos: topVideos.map((v) => ({ videoId: v.videoId as string, results: v._count._all })),
    ads: adsOk ? { connected: true as const } : { connected: false as const, reason: st('meta_ads')?.status ?? 'unknown' },
    sales: shopOk ? { connected: true as const, orders30d: orders30, revenue30d: Number(sales30._sum.amount ?? 0) } : { connected: false as const, reason: st('shopify')?.status ?? 'unknown' },
    najm: { built: false, integration: st('najm_llm') ?? null },
    systems: SYSTEMS,
    integrations: states,
    killSwitch: kill,
    jobs, notifications: notes, attention: open, db: db_, rejectedWebhooks24h: badHooks,
  };
}
export type CommandCenter = Awaited<ReturnType<typeof commandCenter>>;
