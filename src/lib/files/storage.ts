import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { checkDeliverable } from './validate';
import { normalizeKeyword } from './validate';

/** Files are stored outside the public web root. Set FILES_DIR to a path outside the project in production. */
export const filesDir = () => process.env.FILES_DIR || path.join(process.cwd(), 'uploads-private');

export async function saveDeliverable(db: PrismaClient, buf: Buffer, input: { originalName: string; title: string; keyword: string; description?: string }) {
  const check = checkDeliverable(input.originalName, new Uint8Array(buf.subarray(0, 1024)), buf.length);
  if (!check.ok) return { ok: false as const, reason: check.reason };
  const keyword = normalizeKeyword(input.keyword);
  if (!keyword || keyword.length > 40) return { ok: false as const, reason: 'keyword' as const };
  const storageName = randomUUID();
  const dir = filesDir(); await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storageName), buf, { mode: 0o600 });
  const row = await db.deliverableFile.create({ data: {
    title: input.title.trim().slice(0, 120), keyword, description: input.description?.trim().slice(0, 500) || null,
    storageName, originalName: path.basename(input.originalName).slice(0, 200), mime: check.mime, size: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex'),
  } });
  return { ok: true as const, id: row.id };
}

/** Reads a stored file and verifies its hash before it is served. */
export async function readDeliverable(storageName: string, expectedSha: string): Promise<Buffer | null> {
  if (!/^[0-9a-f-]{36}$/.test(storageName)) return null;
  const buf = await readFile(path.join(filesDir(), storageName));
  return createHash('sha256').update(buf).digest('hex') === expectedSha ? buf : null;
}

/** A public link deliverable (for example a reel). Only https URLs are accepted. Nothing is stored on disk. */
export async function saveLink(db: PrismaClient, input: { title: string; keyword: string; url: string; description?: string }) {
  let u: URL;
  try { u = new URL(input.url.trim()); } catch { return { ok: false as const, reason: 'url' as const }; }
  if (u.protocol !== 'https:' || u.href.length > 500 || u.username || u.password) return { ok: false as const, reason: 'url' as const };
  const keyword = normalizeKeyword(input.keyword);
  if (!keyword || keyword.length > 40) return { ok: false as const, reason: 'keyword' as const };
  const row = await db.deliverableFile.create({ data: {
    title: input.title.trim().slice(0, 120), keyword, description: input.description?.trim().slice(0, 500) || null,
    kind: 'link', url: u.href,
  } });
  return { ok: true as const, id: row.id };
}
