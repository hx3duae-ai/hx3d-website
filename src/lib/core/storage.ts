/**
 * File Storage + secure download links.
 * Files live outside the web root (STORAGE_DIR, default ./uploads-private). Content is checked by its bytes, not its name.
 * Download links: random 256-bit token shown once, only its SHA-256 is stored; expiry, download limit, revocation.
 * Private files can only be granted for a verified order or by a staff member (manual); campaigns may only send 'free' files.
 */
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PrismaClient, StoredFile } from '@prisma/client';
import { HxError } from './errors';

type Db = PrismaClient;
const ROOT = () => path.resolve(process.env.STORAGE_DIR || 'uploads-private');
const MAX_BYTES = () => Number(process.env.STORAGE_MAX_MB || 200) * 1024 * 1024;
const MAX_TTL_MIN = 7 * 24 * 60;
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');

export type Kind = 'stl' | '3mf' | 'pdf' | 'mp4' | 'png' | 'jpg';
const MIME: Record<Kind, string> = { stl: 'model/stl', '3mf': 'model/3mf', pdf: 'application/pdf', mp4: 'video/mp4', png: 'image/png', jpg: 'image/jpeg' };

/** Identifies the file type from its content. Returns null for anything not on the allow-list. */
export function sniff(buf: Buffer): Kind | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 12 && buf.subarray(4, 8).toString('latin1') === 'ftyp') return 'mp4';
  if (buf.length >= 4 && buf.readUInt32LE(0) === 0x04034b50) return buf.includes(Buffer.from('3D/3dmodel.model')) ? '3mf' : null; // zip that is a 3MF package
  if (buf.length >= 84 && 84 + buf.readUInt32LE(80) * 50 === buf.length) return 'stl';                                         // binary STL: size is exact
  const head = buf.subarray(0, 512).toString('latin1');
  if (/^\s*solid\b/.test(head) && buf.subarray(-512).toString('latin1').includes('endsolid')) return 'stl';                   // ASCII STL
  return null;
}

/** Resolves a storage key safely: no absolute paths, no "..", always inside ROOT. */
export function keyPath(key: string): string {
  if (!/^[a-z0-9/_.-]{3,200}$/.test(key) || key.includes('..') || key.startsWith('/')) throw new HxError('invalid_input', 'bad storage key');
  const p = path.resolve(ROOT(), key);
  if (!p.startsWith(ROOT() + path.sep)) throw new HxError('invalid_input', 'bad storage key');
  return p;
}

export async function storeFile(db: Db, buf: Buffer, o: { name: string; visibility?: 'private' | 'free'; uploadedBy?: string; productRef?: string }): Promise<StoredFile> {
  if (buf.length === 0 || buf.length > MAX_BYTES()) throw new HxError('invalid_input', 'file is empty or too large');
  const kind = sniff(buf); if (!kind) throw new HxError('invalid_input', 'file type not allowed (STL, 3MF, PDF, MP4, PNG, JPG)');
  const d = new Date(); const key = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${randomBytes(12).toString('hex')}.${kind}`;
  const p = keyPath(key); await mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.part`; await writeFile(tmp, buf, { mode: 0o600 }); await rename(tmp, p);
  const name = o.name.replace(/[^\p{L}\p{N} ._()-]/gu, '_').slice(0, 120) || `file.${kind}`;
  return db.storedFile.create({ data: { storageKey: key, name, kind, mime: MIME[kind], size: buf.length, sha256: sha(buf), visibility: o.visibility ?? 'private', uploadedBy: o.uploadedBy ?? null, productRef: o.productRef ?? null } });
}
export async function readStored(f: Pick<StoredFile, 'storageKey' | 'sha256'>) {
  const buf = await readFile(keyPath(f.storageKey));
  if (sha(buf) !== f.sha256) throw new HxError('internal', 'stored file failed its integrity check');
  return buf;
}
export async function deleteStored(db: Db, id: string) {
  const f = await db.storedFile.update({ where: { id }, data: { deletedAt: new Date() } });
  await db.downloadGrant.updateMany({ where: { fileId: id, revokedAt: null }, data: { revokedAt: new Date(), revokedBy: 'file-deleted' } });
  await rm(keyPath(f.storageKey), { force: true });
  return f;
}
export const storageHealth = async () => { try { await mkdir(ROOT(), { recursive: true }); await stat(ROOT()); return { ok: true }; } catch { return { ok: false }; } };

export type GrantInput = { fileId: string; contactId?: string | null; reason: string; ttlMinutes?: number; maxDownloads?: number; createdBy?: string };
/** Returns the raw token ONCE. Callers build the link; it is never stored or logged. */
export async function createGrant(db: Db, g: GrantInput): Promise<{ token: string; grantId: string; expiresAt: Date }> {
  const file = await db.storedFile.findUnique({ where: { id: g.fileId } });
  if (!file || file.deletedAt) throw new HxError('not_found', 'file not found');
  const reasonOk = /^(campaign|order|manual):[A-Za-z0-9_.:-]{1,100}$/.test(g.reason);
  if (!reasonOk) throw new HxError('invalid_input', 'reason must be campaign:<id>, order:<id> or manual:<id>');
  if (file.visibility === 'private' && g.reason.startsWith('campaign:'))
    throw new HxError('policy_blocked', 'private files are only sent for a verified order or by staff, never by a campaign');
  const ttl = Math.min(Math.max(g.ttlMinutes ?? 24 * 60, 5), MAX_TTL_MIN); const max = Math.min(Math.max(g.maxDownloads ?? 3, 1), 20);
  const token = randomBytes(32).toString('base64url'); const expiresAt = new Date(Date.now() + ttl * 60_000);
  const r = await db.downloadGrant.create({ data: { tokenHash: sha(token), fileId: file.id, contactId: g.contactId ?? null, reason: g.reason, expiresAt, maxDownloads: max, createdBy: g.createdBy ?? null } });
  return { token, grantId: r.id, expiresAt };
}
export const downloadUrl = (token: string) => `${(process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/files/${token}`;

/** Atomically counts one download. Any failure returns null (the route answers a generic 404: nothing is revealed). */
export async function consumeGrant(db: Db, token: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const g = await db.downloadGrant.findUnique({ where: { tokenHash: sha(token) }, include: { file: true } });
  if (!g || g.revokedAt || g.expiresAt < new Date() || g.file.deletedAt) return null;
  const upd = await db.downloadGrant.updateMany({ where: { id: g.id, revokedAt: null, downloads: { lt: g.maxDownloads }, expiresAt: { gt: new Date() } }, data: { downloads: { increment: 1 }, lastUsedAt: new Date() } });
  if (upd.count !== 1) return null;
  return g;
}
export const revokeGrant = (db: Db, id: string, actorId: string) => db.downloadGrant.update({ where: { id }, data: { revokedAt: new Date(), revokedBy: actorId } });
