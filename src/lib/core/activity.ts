/** Unified activity stream + contacts. Every system records what happened here; the Command Center only reads. */
import type { PrismaClient, Prisma } from '@prisma/client';

export type ActivityInput = { system: 'core' | 'najm' | 'social' | 'marketing' | 'reels' | 'shop'; type: string; contactId?: string | null; videoId?: string | null; campaignId?: string | null; amount?: number | null; currency?: string | null; meta?: Prisma.InputJsonValue };
export const recordActivity = (db: Pick<PrismaClient, 'activityEvent'>, a: ActivityInput) =>
  db.activityEvent.create({ data: { system: a.system, type: a.type, contactId: a.contactId ?? null, videoId: a.videoId ?? null, campaignId: a.campaignId ?? null, amount: a.amount ?? null, currency: a.currency ?? null, meta: a.meta } });

/** Finds or creates the contact behind a channel identity (e.g. an Instagram-scoped user id). */
export async function contactFor(db: PrismaClient, channel: string, externalId: string, displayName?: string) {
  if (!/^[a-z_]{2,20}$/.test(channel) || !externalId || externalId.length > 200) throw new Error('invalid identity');
  const found = await db.contactIdentity.findUnique({ where: { channel_externalId: { channel, externalId } }, include: { contact: true } });
  if (found) { await db.contact.update({ where: { id: found.contactId }, data: { lastSeenAt: new Date() } }); return found.contact; }
  try {
    return await db.contact.create({ data: { displayName: displayName?.slice(0, 120) ?? null, identities: { create: { channel, externalId } } } });
  } catch (e) {
    if ((e as { code?: string }).code !== 'P2002') throw e;        // created concurrently by another request
    return (await db.contactIdentity.findUniqueOrThrow({ where: { channel_externalId: { channel, externalId } }, include: { contact: true } })).contact;
  }
}
