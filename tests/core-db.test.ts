import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createHmac, randomBytes, createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { putSecret, getSecret, secretStatus, rotateAll, resolveSecret } from '@/lib/core/secrets';
import { gate, setMode, setEnabled, setKillSwitch } from '@/lib/core/integrations';
import { enqueue, runOne, claim, recoverStale, queueStats, retryDead } from '@/lib/core/jobs';
import { HxError, fromHttpStatus } from '@/lib/core/errors';
import { receiveWebhook, metaVerifyChallenge } from '@/lib/core/webhooks';
import { storeFile, readStored, createGrant, consumeGrant, revokeGrant, deleteStored } from '@/lib/core/storage';
import { contactFor, recordActivity } from '@/lib/core/activity';
import { notify, listOpen, resolve } from '@/lib/core/notifications';
import { commandCenter } from '@/lib/core/command-center';
import { checkIntegration } from '@/lib/core/health';
import { coreHandlers } from '@/lib/core/handlers';

const db = new PrismaClient();
const run = process.env.DATABASE_URL ? describe : describe.skip;
const KEY = randomBytes(32).toString('base64');
const hdr = (o: Record<string, string>) => new Headers(o);
const t = (p: string) => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${p}`;

run('HX Core on a real Postgres database', () => {
  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = KEY; process.env.STORAGE_DIR = mkdtempSync(path.join(tmpdir(), 'hxstore-'));
    for (const v of ['META_APP_SECRET', 'META_WEBHOOK_VERIFY_TOKEN', 'SHOPIFY_WEBHOOK_SECRET']) delete process.env[v];
  });
  beforeEach(async () => {
    await db.job.deleteMany({}); await db.webhookDelivery.deleteMany({}); await db.notification.deleteMany({});
    await db.integration.deleteMany({}); await db.secret.deleteMany({});
  });
  afterAll(async () => {
    await db.downloadGrant.deleteMany({}); await db.storedFile.deleteMany({}); await db.activityEvent.deleteMany({}); await db.contact.deleteMany({});
    await db.job.deleteMany({}); await db.webhookDelivery.deleteMany({}); await db.notification.deleteMany({}); await db.integration.deleteMany({}); await db.secret.deleteMany({});
    await db.$disconnect();
  });

  describe('Secrets Manager', () => {
    it('stores only ciphertext and a 4-char fingerprint', async () => {
      await putSecret(db, 'meta.app_secret', 'very-secret-app-value-9876', 'admin1');
      const row = await db.secret.findUniqueOrThrow({ where: { name: 'meta.app_secret' } });
      expect(JSON.stringify(row)).not.toContain('very-secret');
      expect(row.fingerprint).toBe('9876');
      expect(await getSecret(db, 'meta.app_secret')).toBe('very-secret-app-value-9876');
      const [st] = await secretStatus(db, ['meta.app_secret']);
      expect(st).toMatchObject({ configured: true, fingerprint: '9876' }); expect(Object.keys(st)).not.toContain('value');
    });
    it('rejects bad names and empty values; vault wins over env', async () => {
      await expect(putSecret(db, '../x', 'v')).rejects.toThrow(); await expect(putSecret(db, 'ok.name', '')).rejects.toThrow();
      process.env.META_APP_SECRET = 'from-env';
      expect(await resolveSecret(db, 'meta.app_secret', 'META_APP_SECRET')).toBe('from-env');
      await putSecret(db, 'meta.app_secret', 'from-vault-123');
      expect(await resolveSecret(db, 'meta.app_secret', 'META_APP_SECRET')).toBe('from-vault-123');
      delete process.env.META_APP_SECRET;
    });
    it('rotates every secret to a new key', async () => {
      await putSecret(db, 'a.one', 'value-one-1111'); await putSecret(db, 'a.two', 'value-two-2222');
      process.env.ENCRYPTION_KEY_PREVIOUS = KEY; process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
      expect(await rotateAll(db)).toBe(2);
      delete process.env.ENCRYPTION_KEY_PREVIOUS;
      expect(await getSecret(db, 'a.two')).toBe('value-two-2222');
      process.env.ENCRYPTION_KEY = KEY;
    });
  });

  describe('Integration Manager policy gate', () => {
    it('blocks everything while disabled (the default)', async () => {
      await expect(gate(db, 'meta_messaging', 'read')).rejects.toMatchObject({ code: 'disabled' });
    });
    it('dry_run simulates sends; test executes; live needs a recorded approval', async () => {
      await setEnabled(db, 'meta_messaging', true);
      expect(await gate(db, 'meta_messaging', 'send')).toBe('simulate');
      await setMode(db, 'meta_messaging', 'test', 'admin1'); expect(await gate(db, 'meta_messaging', 'send')).toBe('execute');
      await db.integration.update({ where: { key: 'meta_messaging' }, data: { mode: 'live', liveApprovedAt: null } });
      await expect(gate(db, 'meta_messaging', 'send')).rejects.toMatchObject({ code: 'policy_blocked' });
      await setMode(db, 'meta_messaging', 'live', 'admin1'); expect(await gate(db, 'meta_messaging', 'send')).toBe('execute');
    });
    it('never lets an integration do an action outside its allow-list (Shopify stays read-only, messaging cannot spend)', async () => {
      await setEnabled(db, 'shopify', true); await setMode(db, 'shopify', 'live', 'admin1');
      await expect(gate(db, 'shopify', 'write')).rejects.toMatchObject({ code: 'policy_blocked' });
      await setEnabled(db, 'meta_messaging', true); await setMode(db, 'meta_messaging', 'live', 'admin1');
      await expect(gate(db, 'meta_messaging', 'spend')).rejects.toMatchObject({ code: 'policy_blocked' });
    });
    it('spending is impossible in dry_run and test', async () => {
      await setEnabled(db, 'meta_ads', true);
      await expect(gate(db, 'meta_ads', 'spend')).rejects.toMatchObject({ code: 'policy_blocked' });
      await setMode(db, 'meta_ads', 'test', 'admin1'); await expect(gate(db, 'meta_ads', 'spend')).rejects.toMatchObject({ code: 'policy_blocked' });
    });
    it('the kill switch stops sends but still allows reads', async () => {
      await setEnabled(db, 'meta_messaging', true); await setMode(db, 'meta_messaging', 'live', 'admin1');
      await setKillSwitch(db, true);
      await expect(gate(db, 'meta_messaging', 'send')).rejects.toMatchObject({ code: 'policy_blocked' });
      expect(await gate(db, 'meta_messaging', 'read')).toBe('execute');
      await setKillSwitch(db, false); expect(await gate(db, 'meta_messaging', 'send')).toBe('execute');
    });
  });

  describe('Job queue', () => {
    it('is idempotent by key', async () => {
      const a = await enqueue(db, 'test.echo', { n: 1 }, { idempotencyKey: 'k1' }); const b = await enqueue(db, 'test.echo', { n: 2 }, { idempotencyKey: 'k1' });
      expect(a.id).toBe(b.id); expect(await db.job.count()).toBe(1);
    });
    it('runs a job and stores its result', async () => {
      await enqueue(db, 'test.echo', { n: 7 });
      const r = await runOne(db, { 'test.echo': async (p) => ({ got: (p as { n: number }).n }) });
      expect(r?.outcome).toBe('succeeded');
      expect((await db.job.findFirstOrThrow()).result).toEqual({ got: 7 });
    });
    it('retries transient errors later, then goes dead with an action-required notification', async () => {
      const j = await enqueue(db, 'test.flaky', {}, { maxAttempts: 2 });
      const h = { 'test.flaky': async () => { throw fromHttpStatus(503); } };
      expect((await runOne(db, h))?.outcome).toBe('retry');
      const after = await db.job.findUniqueOrThrow({ where: { id: j.id } });
      expect(after.status).toBe('failed'); expect(after.runAt.getTime()).toBeGreaterThanOrEqual(Date.now() - 50);
      await db.job.update({ where: { id: j.id }, data: { runAt: new Date(Date.now() - 1000) } });
      expect((await runOne(db, h))?.outcome).toBe('dead');
      const n = await listOpen(db); expect(n.some((x) => x.actionRequired && x.title.includes('test.flaky'))).toBe(true);
      await retryDead(db, j.id); expect((await db.job.findUniqueOrThrow({ where: { id: j.id } })).status).toBe('queued');
    });
    it('permanent errors and unknown job types go dead immediately', async () => {
      await enqueue(db, 'test.bad', {}); expect((await runOne(db, { 'test.bad': async () => { throw new HxError('invalid_input', 'nope'); } }))?.outcome).toBe('dead');
      await enqueue(db, 'test.nohandler', {}); expect((await runOne(db, {}))?.outcome).toBe('dead');
    });
    it('never gives the same job to two workers (SKIP LOCKED; 6 separate clients = 6 workers)', async () => {
      for (let i = 0; i < 30; i++) await enqueue(db, 'test.c', { i });
      const workers = Array.from({ length: 6 }, () => new PrismaClient());
      try {
        const claims = await Promise.all(Array.from({ length: 60 }, (_, i) => claim(workers[i % 6], `w${i}`)));
        const ids = claims.filter(Boolean).map((j) => j!.id);
        expect(ids.length).toBe(30); expect(new Set(ids).size).toBe(30);
        expect((await db.job.aggregate({ _max: { attempts: true } }))._max.attempts).toBe(1);
      } finally { await Promise.all(workers.map((w) => w.$disconnect())); }
    });
    it('recovers jobs from a crashed worker', async () => {
      const j = await enqueue(db, 'test.stale', {}); await claim(db, 'dead-worker');
      await db.job.update({ where: { id: j.id }, data: { lockedAt: new Date(Date.now() - 3600_000) } });
      expect(await recoverStale(db)).toBe(1); expect((await queueStats(db)).failed).toBe(1);
    });
  });

  describe('Webhook Manager', () => {
    const body = JSON.stringify({ object: 'instagram', entry: [{ id: '1', changes: [{ field: 'comments', value: { text: 'ملف' } }] }] });
    const sign = (b: string, s: string) => 'sha256=' + createHmac('sha256', s).update(b).digest('hex');
    it('answers 503 when no secret is configured, and stores nothing', async () => {
      const r = await receiveWebhook(db, 'meta', body, hdr({ 'x-hub-signature-256': sign(body, 'x') }));
      expect(r.status).toBe(503); expect(await db.webhookDelivery.count()).toBe(0);
    });
    it('rejects a bad signature without storing the payload', async () => {
      await putSecret(db, 'meta.app_secret', 'real-app-secret-1');
      const r = await receiveWebhook(db, 'meta', body, hdr({ 'x-hub-signature-256': sign(body, 'attacker') }));
      expect(r).toMatchObject({ status: 401, outcome: 'rejected' }); expect(await db.webhookDelivery.count()).toBe(0);
      expect((await listOpen(db)).some((n) => n.title.includes('invalid signature'))).toBe(true);
    });
    it('keeps but ignores events while the integration is disabled', async () => {
      await putSecret(db, 'meta.app_secret', 'real-app-secret-1');
      const r = await receiveWebhook(db, 'meta', body, hdr({ 'x-hub-signature-256': sign(body, 'real-app-secret-1') }));
      expect(r).toMatchObject({ status: 200, outcome: 'ignored' }); expect(await db.job.count()).toBe(0);
    });
    it('queues a valid event once; a redelivery is a duplicate; the core handler processes it', async () => {
      await putSecret(db, 'meta.app_secret', 'real-app-secret-1'); await setEnabled(db, 'meta_messaging', true);
      const h = hdr({ 'x-hub-signature-256': sign(body, 'real-app-secret-1') });
      expect((await receiveWebhook(db, 'meta', body, h)).outcome).toBe('queued');
      expect((await receiveWebhook(db, 'meta', body, h)).outcome).toBe('duplicate');
      expect(await db.job.count()).toBe(1);
      expect((await runOne(db, coreHandlers))?.outcome).toBe('succeeded');
      expect((await db.webhookDelivery.findFirstOrThrow()).status).toBe('processed');
    });
    it('verifies Shopify webhooks with the existing HMAC check and its delivery id', async () => {
      await putSecret(db, 'shopify.webhook_secret', 'shop-hook-secret'); await setEnabled(db, 'shopify', true);
      const b = '{"id":1}'; const sig = createHmac('sha256', 'shop-hook-secret').update(b).digest('base64');
      expect((await receiveWebhook(db, 'shopify', b, hdr({ 'x-shopify-hmac-sha256': sig, 'x-shopify-webhook-id': 'w-1', 'x-shopify-topic': 'orders/create' }))).outcome).toBe('queued');
      expect((await receiveWebhook(db, 'shopify', b, hdr({ 'x-shopify-hmac-sha256': sig, 'x-shopify-webhook-id': 'w-1' }))).outcome).toBe('duplicate');
      expect((await receiveWebhook(db, 'shopify', b, hdr({ 'x-shopify-hmac-sha256': 'AAAA', 'x-shopify-webhook-id': 'w-2' }))).status).toBe(401);
    });
    it('refuses unknown sources and oversized bodies', async () => {
      expect((await receiveWebhook(db, 'evil', '{}', hdr({}))).status).toBe(404);
      expect((await receiveWebhook(db, 'meta', 'x'.repeat(1_000_001), hdr({}))).status).toBe(413);
    });
    it('Meta GET handshake: only the right verify token echoes the challenge', async () => {
      await putSecret(db, 'meta.webhook_verify_token', 'my-verify-token');
      const q = (tok: string, ch = '12345') => new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': tok, 'hub.challenge': ch });
      expect(await metaVerifyChallenge(db, q('my-verify-token'))).toEqual({ status: 200, body: '12345' });
      expect((await metaVerifyChallenge(db, q('wrong'))).status).toBe(403);
      expect((await metaVerifyChallenge(db, q('my-verify-token', '<script>'))).status).toBe(403);
    });
  });

  describe('File storage and secure download links', () => {
    const stl = () => { const b = Buffer.alloc(84 + 50); b.writeUInt32LE(1, 80); return b; };
    it('stores outside the web root with an integrity hash and refuses disallowed types', async () => {
      const f = await storeFile(db, stl(), { name: 'keychain.stl', visibility: 'free' });
      expect(f.kind).toBe('stl'); expect(f.storageKey).toMatch(/^\d{4}\/\d{2}\/[0-9a-f]{24}\.stl$/);
      expect((await readStored(f)).length).toBe(134);
      const p = path.join(process.env.STORAGE_DIR!, f.storageKey); expect(statSync(p).mode & 0o077).toBe(0);
      await expect(storeFile(db, Buffer.from('MZ evil'), { name: 'x.stl' })).rejects.toThrow(/not allowed/);
    });
    it('campaigns can never send private files; orders and staff can', async () => {
      const f = await storeFile(db, stl(), { name: 'paid-model.stl' });
      await expect(createGrant(db, { fileId: f.id, reason: 'campaign:c1' })).rejects.toMatchObject({ code: 'policy_blocked' });
      await expect(createGrant(db, { fileId: f.id, reason: 'order:1001' })).resolves.toBeTruthy();
      await expect(createGrant(db, { fileId: f.id, reason: 'anything' })).rejects.toThrow();
    });
    it('a link works only up to its download limit, and only its hash is stored', async () => {
      const f = await storeFile(db, stl(), { name: 'free.stl', visibility: 'free' });
      const g = await createGrant(db, { fileId: f.id, reason: 'campaign:c1', maxDownloads: 2 });
      const row = await db.downloadGrant.findUniqueOrThrow({ where: { id: g.grantId } });
      expect(row.tokenHash).toBe(createHash('sha256').update(g.token).digest('hex')); expect(JSON.stringify(row)).not.toContain(g.token);
      expect(await consumeGrant(db, g.token)).toBeTruthy(); expect(await consumeGrant(db, g.token)).toBeTruthy();
      expect(await consumeGrant(db, g.token)).toBeNull();
    });
    it('concurrent downloads cannot exceed the limit', async () => {
      const f = await storeFile(db, stl(), { name: 'race.stl', visibility: 'free' });
      const g = await createGrant(db, { fileId: f.id, reason: 'campaign:c1', maxDownloads: 3 });
      const r = await Promise.all(Array.from({ length: 10 }, () => consumeGrant(db, g.token)));
      expect(r.filter(Boolean).length).toBe(3);
    });
    it('expired, revoked and deleted-file links stop working', async () => {
      const f = await storeFile(db, stl(), { name: 'e.stl', visibility: 'free' });
      const a = await createGrant(db, { fileId: f.id, reason: 'campaign:c1' });
      await db.downloadGrant.update({ where: { id: a.grantId }, data: { expiresAt: new Date(Date.now() - 1000) } });
      expect(await consumeGrant(db, a.token)).toBeNull();
      const b = await createGrant(db, { fileId: f.id, reason: 'campaign:c1' }); await revokeGrant(db, b.grantId, 'admin1');
      expect(await consumeGrant(db, b.token)).toBeNull();
      const c = await createGrant(db, { fileId: f.id, reason: 'campaign:c1' }); await deleteStored(db, f.id);
      expect(await consumeGrant(db, c.token)).toBeNull();
      expect(await consumeGrant(db, 'not-a-token')).toBeNull();
    });
    it('the download route serves the file as an attachment and answers 404 for anything else', async () => {
      const { GET } = await import('@/app/api/files/[token]/route');
      const f = await storeFile(db, stl(), { name: 'ميدالية.stl', visibility: 'free' });
      const g = await createGrant(db, { fileId: f.id, reason: 'campaign:c1', maxDownloads: 1 });
      const ok = await GET(new Request('http://x'), { params: Promise.resolve({ token: g.token }) });
      expect(ok.status).toBe(200); expect(ok.headers.get('content-disposition')).toMatch(/^attachment/); expect(ok.headers.get('cache-control')).toContain('no-store');
      expect((await ok.arrayBuffer()).byteLength).toBe(134);
      expect((await GET(new Request('http://x'), { params: Promise.resolve({ token: g.token }) })).status).toBe(404);
    });
    it('detects a file that was changed on disk', async () => {
      const f = await storeFile(db, stl(), { name: 't.stl' });
      await expect(readStored({ ...f, sha256: '0'.repeat(64) })).rejects.toThrow(/integrity/);
    });
  });

  describe('Contacts, activity, notifications, health, Command Center', () => {
    it('one contact per channel identity, even under concurrency', async () => {
      const ext = t('ig');
      const cs = await Promise.all(Array.from({ length: 5 }, () => contactFor(db, 'instagram', ext, 'Sara')));
      expect(new Set(cs.map((c) => c.id)).size).toBe(1);
    });
    it('notifications with the same key are merged and reopened', async () => {
      await notify(db, { level: 'error', source: 'x', title: 'Shopify down', dedupeKey: 'k' });
      const n = await notify(db, { level: 'error', source: 'x', title: 'Shopify down', dedupeKey: 'k' }); expect(n.count).toBe(2);
      await resolve(db, n.id, 'admin1'); expect((await listOpen(db)).length).toBe(0);
      await notify(db, { level: 'error', source: 'x', title: 'Shopify down', dedupeKey: 'k' }); expect((await listOpen(db)).length).toBe(1);
    });
    it('health: unconfigured integrations are reported as such, never as ok', async () => {
      expect((await checkIntegration(db, 'meta_ads')).status).toBe('not_configured');
      await putSecret(db, 'meta_ads.system_user_token', 'EAAfake-token-123456');
      expect((await checkIntegration(db, 'meta_ads')).status).toBe('unverified');
      delete process.env.HX_STUDIO_URL; expect((await checkIntegration(db, 'hx_studio')).status).toBe('not_configured');
      process.env.HX_STUDIO_URL = 'http://studio.local';
      expect((await checkIntegration(db, 'hx_studio', async () => new Response('{}', { status: 200 }))).status).toBe('ok');
      expect((await checkIntegration(db, 'hx_studio', async () => { throw new TypeError('fetch failed'); })).status).toBe('error');
      delete process.env.HX_STUDIO_URL;
    });
    it('Command Center counts real activity and hides sales/ads until their sources are connected', async () => {
      const c = await contactFor(db, 'instagram', t('ig'));
      await recordActivity(db, { system: 'social', type: 'file.sent', contactId: c.id, videoId: 'vid-A' });
      await recordActivity(db, { system: 'social', type: 'file.sent', contactId: c.id, videoId: 'vid-A' });
      await recordActivity(db, { system: 'social', type: 'contact.new', contactId: c.id, videoId: 'vid-B' });
      await recordActivity(db, { system: 'shop', type: 'order.created', amount: 120, currency: 'AED' });
      const cc = await commandCenter(db);
      expect(cc.files.sent30d).toBeGreaterThanOrEqual(2);
      expect(cc.topVideos[0]).toEqual({ videoId: 'vid-A', results: 2 });
      expect(cc.sales.connected).toBe(false); expect(cc.ads.connected).toBe(false);
      expect(cc.najm.built).toBe(false); expect(cc.db.ok).toBe(true);
    });
  });
});
