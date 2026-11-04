/**
 * Secure Secrets Manager: AES-256-GCM, key from the ENCRYPTION_KEY environment variable (32 bytes, base64 or hex).
 * Rotation: put the old key in ENCRYPTION_KEY_PREVIOUS, call rotateAll(), then remove it.
 * The API is write-only towards the UI: status() returns a fingerprint, never the value.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { HxError } from './errors';

type Db = Pick<PrismaClient, 'secret'>;
type Key = { id: string; key: Buffer };
const NAME_RE = /^[a-z0-9][a-z0-9_.:-]{2,63}$/;

function parseKey(raw: string | undefined): Key | null {
  const v = (raw ?? '').trim(); if (!v) return null;
  const key = /^[0-9a-f]{64}$/i.test(v) ? Buffer.from(v, 'hex') : Buffer.from(v, 'base64');
  if (key.length !== 32) throw new HxError('not_configured', 'ENCRYPTION_KEY must be 32 bytes (base64 or 64 hex chars)');
  return { id: createHash('sha256').update(key).digest('hex').slice(0, 8), key };
}
export function currentKey(): Key {
  const k = parseKey(process.env.ENCRYPTION_KEY);
  if (!k) throw new HxError('not_configured', 'ENCRYPTION_KEY is not set: secrets cannot be stored');
  return k;
}
function keyById(id: string): Key | null {
  for (const raw of [process.env.ENCRYPTION_KEY, process.env.ENCRYPTION_KEY_PREVIOUS]) { const k = parseKey(raw); if (k?.id === id) return k; }
  return null;
}
export const vaultConfigured = () => { try { currentKey(); return true; } catch { return false; } };

export function encrypt(plain: string, aad: string) {
  const k = currentKey(); const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', k.key, iv); c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return { ciphertext: ct.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), keyId: k.id };
}
export function decrypt(row: { ciphertext: string; iv: string; tag: string; keyId: string }, aad: string): string {
  const k = keyById(row.keyId); if (!k) throw new HxError('not_configured', 'the key that encrypted this secret is not available');
  const d = createDecipheriv('aes-256-gcm', k.key, Buffer.from(row.iv, 'base64')); d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(row.tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(row.ciphertext, 'base64')), d.final()]).toString('utf8');
}

const fingerprint = (v: string) => (v.length >= 8 ? v.slice(-4) : '****');

export async function putSecret(db: Db, name: string, value: string, actorId?: string) {
  if (!NAME_RE.test(name)) throw new HxError('invalid_input', 'invalid secret name');
  if (!value || value.length > 8192) throw new HxError('invalid_input', 'secret is empty or too long');
  const enc = encrypt(value, name);   // the name is authenticated data: a ciphertext cannot be moved to another name
  const data = { ...enc, fingerprint: fingerprint(value), updatedBy: actorId ?? null };
  await db.secret.upsert({ where: { name }, create: { name, ...data }, update: data });
  return { name, fingerprint: data.fingerprint };
}
/** Server-side only. Never pass the result to a client component, a log line or an error message. */
export async function getSecret(db: Db, name: string): Promise<string | null> {
  const r = await db.secret.findUnique({ where: { name } }); if (!r) return null;
  try { return decrypt(r, name); } catch { return null; }
}
/** Vault first, then the environment variable (for deployments that inject secrets as env vars). */
export async function resolveSecret(db: Db, name: string, envName?: string): Promise<string | null> {
  return (await getSecret(db, name)) ?? ((envName && process.env[envName]?.trim()) || null);
}
export async function deleteSecret(db: Db, name: string) { await db.secret.deleteMany({ where: { name } }); }
export async function secretStatus(db: Db, names: string[]) {
  const rows = await db.secret.findMany({ where: { name: { in: names } }, select: { name: true, fingerprint: true, updatedAt: true } });
  return names.map((n) => { const r = rows.find((x) => x.name === n); return { name: n, configured: !!r, fingerprint: r?.fingerprint ?? null, updatedAt: r?.updatedAt ?? null }; });
}
/** Re-encrypt every secret with the current key (after setting ENCRYPTION_KEY_PREVIOUS to the old key). */
export async function rotateAll(db: Db) {
  const k = currentKey(); let n = 0;
  for (const r of await db.secret.findMany()) {
    if (r.keyId === k.id) continue;
    const plain = decrypt(r, r.name); await db.secret.update({ where: { name: r.name }, data: encrypt(plain, r.name) }); n++;
  }
  return n;
}
