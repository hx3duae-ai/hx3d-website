import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

type Db = PrismaClient;
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
export const DEFAULT_TTL_HOURS = 48;
export const MAX_TTL_HOURS = 24 * 14;

/** Creates a link. The raw token is returned once; only its hash is stored. */
export async function createLink(db: Db, fileId: string, o: { ttlHours?: number; maxDownloads?: number; recipient?: string } = {}) {
  const ttl = Math.min(Math.max(o.ttlHours ?? DEFAULT_TTL_HOURS, 1), MAX_TTL_HOURS);
  const max = Math.min(Math.max(o.maxDownloads ?? 1, 1), 20);
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttl * 3600_000);
  await db.downloadLink.create({ data: { tokenHash: hashToken(token), fileId, expiresAt, maxDownloads: max, recipient: o.recipient?.slice(0, 120) || null } });
  return { token, expiresAt, maxDownloads: max };
}

export type Redeem =
  | { ok: true; storageName: string; originalName: string; mime: string; size: number }
  | { ok: false; reason: 'not_found' | 'expired' | 'revoked' | 'used_up' | 'file_inactive' };

/** Atomically consumes one download. Two simultaneous requests cannot both pass the limit. */
export async function redeem(db: Db, token: string, now = new Date()): Promise<Redeem> {
  const link = await db.downloadLink.findUnique({ where: { tokenHash: hashToken(token) }, include: { file: true } });
  if (!link) return { ok: false, reason: 'not_found' };
  if (link.revokedAt) return { ok: false, reason: 'revoked' };
  if (link.expiresAt <= now) return { ok: false, reason: 'expired' };
  if (!link.file.active) return { ok: false, reason: 'file_inactive' };
  const r = await db.downloadLink.updateMany({
    where: { id: link.id, revokedAt: null, expiresAt: { gt: now }, downloads: { lt: link.maxDownloads } },
    data: { downloads: { increment: 1 } },
  });
  if (r.count !== 1) return { ok: false, reason: 'used_up' };
  await db.downloadEvent.create({ data: { linkId: link.id } });
  return { ok: true, storageName: link.file.storageName, originalName: link.file.originalName, mime: link.file.mime, size: link.file.size };
}

export const revokeLink = (db: Db, linkId: string) => db.downloadLink.updateMany({ where: { id: linkId, revokedAt: null }, data: { revokedAt: new Date() } });
