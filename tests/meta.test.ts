import { describe, it, expect, afterAll } from 'vitest';
import { createHmac } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { verifyMetaSignature, verifySubscription, parseInbound } from '@/lib/meta/webhook';
import { ingestEvents } from '@/lib/meta/drafts';

const SECRET = 'meta-app-secret-test';
const sign = (body: string, s = SECRET) => 'sha256=' + createHmac('sha256', s).update(body, 'utf8').digest('hex');

describe('Meta webhook signature', () => {
  const body = '{"object":"instagram","entry":[]}';
  it('accepts the correct signature', () => expect(verifyMetaSignature(body, sign(body), SECRET)).toBe(true));
  it('rejects a tampered body, a wrong secret, a missing or malformed header', () => {
    expect(verifyMetaSignature(body + ' ', sign(body), SECRET)).toBe(false);
    expect(verifyMetaSignature(body, sign(body, 'other'), SECRET)).toBe(false);
    expect(verifyMetaSignature(body, null, SECRET)).toBe(false);
    expect(verifyMetaSignature(body, 'sha1=abc', SECRET)).toBe(false);
    expect(verifyMetaSignature(body, sign(body), '')).toBe(false);
  });
});

describe('subscription handshake', () => {
  it('echoes the challenge only with the right verify token', () => {
    const q = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': 'vt-123', 'hub.challenge': '555' });
    expect(verifySubscription(q, 'vt-123')).toBe('555');
    expect(verifySubscription(q, 'wrong')).toBeNull();
    expect(verifySubscription(new URLSearchParams({ 'hub.mode': 'unsubscribe', 'hub.verify_token': 'vt-123', 'hub.challenge': '1' }), 'vt-123')).toBeNull();
    expect(verifySubscription(q, '')).toBeNull();
  });
});

describe('parseInbound', () => {
  it('extracts text DMs and comments, and ignores echoes, media and other objects', () => {
    const ev = parseInbound({ object: 'instagram', entry: [
      { messaging: [
        { sender: { id: 'u1' }, message: { mid: 'm1', text: 'ابغى ملف' } },
        { sender: { id: 'u2' }, message: { mid: 'm2', text: 'sent', is_echo: true } },
        { sender: { id: 'u3' }, message: { mid: 'm3', attachments: [{}] } },
      ], changes: [
        { field: 'comments', value: { id: 'c1', text: 'ملف لو سمحت', from: { id: 'u4' } } },
        { field: 'mentions', value: { id: 'x', text: 'ملف', from: { id: 'u5' } } },
      ] },
    ] });
    expect(ev).toEqual([
      { channel: 'instagram_dm', senderRef: 'u1', text: 'ابغى ملف', mid: 'm1' },
      { channel: 'instagram_comment', senderRef: 'u4', text: 'ملف لو سمحت', mid: 'c1' },
    ]);
    expect(parseInbound({ object: 'page', entry: [{ messaging: [{ sender: { id: 'x' }, message: { mid: 'y', text: 'ملف' } }] }] })).toEqual([]);
    expect(parseInbound(null)).toEqual([]);
  });
});

const run = process.env.DATABASE_URL ? describe : describe.skip;
const db = new PrismaClient();
run('reply drafts (real database)', () => {
  afterAll(async () => {
    await db.replyDraft.deleteMany({ where: { inboundMid: { startsWith: 'test-mid-' } } });
    await db.deliverableFile.deleteMany({ where: { keyword: { startsWith: 'test-meta-' } } });
    await db.$disconnect();
  });
  it('creates one pending draft per keyword message, never twice for the same id', async () => {
    await db.deliverableFile.create({ data: { title: 'Guide', keyword: 'test-meta-guide', storageName: 'aaaaaaaa-0000-4000-8000-000000000001', originalName: 'g.pdf', mime: 'application/pdf', size: 4, sha256: 'x'.repeat(64) } });
    const ev = [{ channel: 'instagram_dm', senderRef: 'u1', text: 'ممكن test-meta-guide من فضلك', mid: 'test-mid-1' }];
    expect(await ingestEvents(db, ev)).toEqual({ created: 1, duplicates: 0, matched: 1 });
    expect(await ingestEvents(db, ev)).toEqual({ created: 0, duplicates: 1, matched: 1 });
    const d = await db.replyDraft.findUniqueOrThrow({ where: { inboundMid: 'test-mid-1' } });
    expect(d.status).toBe('pending');
    expect(d.draftText).toContain('{LINK}'); // no link exists until an admin approves
    expect(d.linkId).toBeNull();
  });
  it('a message without a keyword creates no draft', async () => {
    const r = await ingestEvents(db, [{ channel: 'instagram_comment', senderRef: 'u2', text: 'جميل جداً', mid: 'test-mid-2' }]);
    expect(r.created).toBe(0);
    expect(await db.replyDraft.count({ where: { inboundMid: 'test-mid-2' } })).toBe(0);
  });
});

describe('draft text never holds a link', () => {
  it('the approve action keeps the {LINK} placeholder (static check of the source)', async () => {
    const src = (await import('node:fs')).readFileSync('src/app/[lang]/admin/outbox/actions.ts', 'utf8');
    expect(src).not.toMatch(/draftText:\s*d\.draftText\.replace/);
  });
});
