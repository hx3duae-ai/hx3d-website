import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { checkDeliverable, normalizeKeyword, MAX_DELIVERABLE_BYTES } from '@/lib/files/validate';
import { matchKeywords } from '@/lib/files/keyword';
import { createLink, redeem, revokeLink, hashToken } from '@/lib/files/links';

const head = (p: string) => new Uint8Array(readFileSync(p)).subarray(0, 1024);

describe('checkDeliverable (decides from real bytes)', () => {
  it('accepts a real STL, PNG and PDF', () => {
    expect(checkDeliverable('cube.stl', head('tests/fixtures/cube.stl'), statSync('tests/fixtures/cube.stl').size)).toMatchObject({ ok: true, kind: 'model' });
    expect(checkDeliverable('pic.png', head('tests/fixtures/pic.png'), 73)).toMatchObject({ ok: true, kind: 'image', mime: 'image/png' });
    const pdf = new TextEncoder().encode('%PDF-1.4\n%test\n');
    expect(checkDeliverable('guide.pdf', pdf, pdf.length)).toMatchObject({ ok: true, kind: 'pdf' });
  });
  it('rejects a text file renamed .stl', () => {
    expect(checkDeliverable('fake.stl', head('tests/fixtures/fake.stl'), 19)).toEqual({ ok: false, reason: 'type' });
  });
  it('rejects an executable renamed .png (MZ header)', () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff]);
    expect(checkDeliverable('setup.png', exe, 1000)).toEqual({ ok: false, reason: 'type' });
  });
  it('rejects empty and oversized files', () => {
    expect(checkDeliverable('a.stl', new Uint8Array(), 0)).toEqual({ ok: false, reason: 'empty' });
    expect(checkDeliverable('a.pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46]), MAX_DELIVERABLE_BYTES + 1)).toEqual({ ok: false, reason: 'too_large' });
  });
});

describe('keywords', () => {
  it('folds case, tashkeel and Arabic letter variants', () => {
    expect(normalizeKeyword('  ملف  ')).toBe(normalizeKeyword('مِلَفّ'));
    expect(normalizeKeyword('إستقبال')).toBe(normalizeKeyword('استقبال'));
    expect(normalizeKeyword('FILE')).toBe('file');
  });
  it('matches whole words only', () => {
    expect(matchKeywords('ابغى ملف لو سمحت', ['ملف', 'صورة'])).toEqual(['ملف']);
    expect(matchKeywords('ملفات كثيرة', ['ملف'])).toEqual([]); // different word, no match
    expect(matchKeywords('الملف!', ['ملف'])).toEqual([]);      // article prefix is a different word
    expect(matchKeywords('ملف!', ['ملف'])).toEqual(['ملف']);
    expect(matchKeywords('send FILE please', ['file'])).toEqual(['file']);
  });
});

const run = process.env.DATABASE_URL ? describe : describe.skip;
const db = new PrismaClient();
run('download links (real database)', () => {
  afterAll(async () => { await db.deliverableFile.deleteMany({ where: { keyword: { startsWith: 'test-' } } }); await db.$disconnect(); });
  const mkFile = async (k: string) => db.deliverableFile.create({ data: { title: 't', keyword: k, storageName: randomUUID(), originalName: 'a.stl', mime: 'model/stl', size: 10, sha256: 'x'.repeat(64) } });

  it('one-time link works once, then reports used_up', async () => {
    const f = await mkFile('test-once');
    const { token } = await createLink(db, f.id, { maxDownloads: 1 });
    expect((await redeem(db, token)).ok).toBe(true);
    expect(await redeem(db, token)).toEqual({ ok: false, reason: 'used_up' });
  });
  it('the raw token is never stored, only its hash', async () => {
    const f = await mkFile('test-hash');
    const { token } = await createLink(db, f.id);
    expect(await db.downloadLink.findUnique({ where: { tokenHash: token } })).toBeNull();
    expect(await db.downloadLink.findUnique({ where: { tokenHash: hashToken(token) } })).not.toBeNull();
  });
  it('expired links are refused', async () => {
    const f = await mkFile('test-exp');
    const { token } = await createLink(db, f.id);
    expect(await redeem(db, token, new Date(Date.now() + 49 * 3600_000))).toEqual({ ok: false, reason: 'expired' });
  });
  it('revoked links are refused', async () => {
    const f = await mkFile('test-rev');
    const { token } = await createLink(db, f.id, { maxDownloads: 5 });
    const l = await db.downloadLink.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
    await revokeLink(db, l.id);
    expect(await redeem(db, token)).toEqual({ ok: false, reason: 'revoked' });
  });
  it('unknown tokens are not found', async () => {
    expect(await redeem(db, 'x'.repeat(43))).toEqual({ ok: false, reason: 'not_found' });
  });
  it('concurrent downloads cannot exceed the limit', async () => {
    const f = await mkFile('test-race');
    const { token } = await createLink(db, f.id, { maxDownloads: 2 });
    const results = await Promise.all(Array.from({ length: 5 }, () => redeem(db, token)));
    expect(results.filter((r) => r.ok).length).toBe(2);
    expect(await db.downloadEvent.count({ where: { link: { tokenHash: hashToken(token) } } })).toBe(2);
  });
});

describe('keyword with punctuation', () => {
  it('matches a hyphenated keyword typed with or without the hyphen', () => {
    expect(matchKeywords('ممكن test-guide من فضلك', ['test-guide'])).toEqual(['test-guide']);
    expect(matchKeywords('test guide please', ['test-guide'])).toEqual(['test-guide']);
  });
});
