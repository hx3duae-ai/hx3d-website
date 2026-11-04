/** Notification Center: one place for problems and decisions that need the owner. Same dedupeKey → one entry with a counter. */
import type { PrismaClient } from '@prisma/client';
import { redact } from './errors';

type Db = Pick<PrismaClient, 'notification'>;
export type NotifyInput = { level: 'info' | 'warning' | 'error'; source: string; title: string; body?: string; actionRequired?: boolean; dedupeKey?: string };

export async function notify(db: Db, n: NotifyInput) {
  const data = { level: n.level, source: n.source, title: redact(n.title).slice(0, 200), body: n.body ? redact(n.body) : null, actionRequired: !!n.actionRequired };
  if (!n.dedupeKey) return db.notification.create({ data });
  return db.notification.upsert({
    where: { dedupeKey: n.dedupeKey },
    create: { ...data, dedupeKey: n.dedupeKey },
    update: { ...data, count: { increment: 1 }, resolvedAt: null, resolvedBy: null, readAt: null }, // a resolved problem that comes back is reopened
  });
}
export const listOpen = (db: Db, take = 50) => db.notification.findMany({ where: { resolvedAt: null }, orderBy: [{ actionRequired: 'desc' }, { updatedAt: 'desc' }], take });
export const listRecent = (db: Db, take = 100) => db.notification.findMany({ orderBy: { updatedAt: 'desc' }, take });
export const resolve = (db: Db, id: string, actorId: string) => db.notification.update({ where: { id }, data: { resolvedAt: new Date(), resolvedBy: actorId, readAt: new Date() } });
export const markRead = (db: Db, id: string) => db.notification.update({ where: { id }, data: { readAt: new Date() } });
export async function counts(db: Db) {
  const [open, action, errors] = await Promise.all([
    db.notification.count({ where: { resolvedAt: null } }),
    db.notification.count({ where: { resolvedAt: null, actionRequired: true } }),
    db.notification.count({ where: { resolvedAt: null, level: 'error' } }),
  ]);
  return { open, action, errors };
}
