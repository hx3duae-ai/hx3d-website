import { describe, it, expect, beforeEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encrypt, decrypt, currentKey } from '@/lib/core/secrets';
import { effectivePermissions, canGrant, ADMIN_ONLY, PERMISSIONS } from '@/lib/core/permissions';
import { redact, fromHttpStatus, HxError, safeError } from '@/lib/core/errors';
import { withRetry, backoffMs } from '@/lib/core/retry';
import { sniff, keyPath } from '@/lib/core/storage';
import { verifyMetaSignature } from '@/lib/core/webhooks';
import { createHmac } from 'node:crypto';

const K1 = randomBytes(32).toString('base64'); const K2 = randomBytes(32).toString('hex');
beforeEach(() => { process.env.ENCRYPTION_KEY = K1; delete process.env.ENCRYPTION_KEY_PREVIOUS; });

describe('AES-256-GCM secret encryption', () => {
  it('round-trips and never contains the plaintext', () => {
    const e = encrypt('EAAB-super-secret-token-123', 'meta.page_token');
    expect(JSON.stringify(e)).not.toContain('super-secret');
    expect(decrypt(e, 'meta.page_token')).toBe('EAAB-super-secret-token-123');
  });
  it('fails on a tampered ciphertext or tag', () => {
    const e = encrypt('value-1234567', 'a.b');
    const bad = { ...e, ciphertext: Buffer.from('x' + e.ciphertext).toString('base64') };
    expect(() => decrypt(bad, 'a.b')).toThrow();
    expect(() => decrypt({ ...e, tag: Buffer.alloc(16).toString('base64') }, 'a.b')).toThrow();
  });
  it('binds the ciphertext to its name (cannot be copied to another secret)', () => {
    const e = encrypt('value-1234567', 'shopify.client_secret');
    expect(() => decrypt(e, 'meta.app_secret')).toThrow();
  });
  it('uses a fresh IV every time', () => { expect(encrypt('same', 'n.n').iv).not.toBe(encrypt('same', 'n.n').iv); });
  it('decrypts with the previous key during rotation, refuses unknown keys', () => {
    const old = encrypt('rotating-value', 'x.y');
    process.env.ENCRYPTION_KEY = K2; process.env.ENCRYPTION_KEY_PREVIOUS = K1;
    expect(decrypt(old, 'x.y')).toBe('rotating-value');
    delete process.env.ENCRYPTION_KEY_PREVIOUS;
    expect(() => decrypt(old, 'x.y')).toThrow(HxError);
  });
  it('refuses to work without a valid 32-byte key', () => {
    delete process.env.ENCRYPTION_KEY; expect(() => currentKey()).toThrow(/ENCRYPTION_KEY/);
    process.env.ENCRYPTION_KEY = 'short'; expect(() => currentKey()).toThrow(/32 bytes/);
  });
});

describe('permissions (separated systems, least privilege)', () => {
  it('customers get nothing, even with grants', () => {
    expect(effectivePermissions({ role: 'CUSTOMER' }, ['command.view', 'social.manage']).size).toBe(0);
  });
  it('admin-only permissions can never be granted', () => {
    for (const p of ADMIN_ONLY) {
      expect(effectivePermissions({ role: 'STAFF' }, [p]).has(p)).toBe(false);
      expect(canGrant({ role: 'STAFF' }, p)).toBe(false);
    }
  });
  it('staff defaults do not include sending, ad drafts or spending', () => {
    const s = effectivePermissions({ role: 'STAFF' });
    for (const p of ['social.send', 'marketing.draft', 'marketing.spend', 'integrations.manage', 'secrets.manage'] as const) expect(s.has(p)).toBe(false);
    expect(s.has('command.view')).toBe(true);
  });
  it('messaging and advertising permissions are independent', () => {
    const s = effectivePermissions({ role: 'STAFF' }, ['social.send']);
    expect(s.has('social.send')).toBe(true); expect(s.has('marketing.draft')).toBe(false);
  });
  it('admin has every permission; unknown grants are ignored', () => {
    expect(effectivePermissions({ role: 'ADMIN' }).size).toBe(PERMISSIONS.length);
    expect(effectivePermissions({ role: 'STAFF' }, ['root.everything']).has('root.everything' as never)).toBe(false);
  });
});

describe('error handling and redaction', () => {
  it('masks Meta, Shopify, Anthropic, bearer and key=value credentials', () => {
    const t = redact('token EAABsbCS1iHgBAKZBxyzZBabcdefghij12345 shpat_1234567890abcdef sk-ant-api03-abcdefghijkl Bearer abc.def.ghi12345 client_secret=hunter2hunter2');
    expect(t).not.toMatch(/EAABsbCS1iHg|shpat_1234567890|sk-ant-api03-abc|abc\.def\.ghi|hunter2/);
  });
  it('classifies HTTP statuses', () => {
    expect(fromHttpStatus(429).retryable).toBe(true); expect(fromHttpStatus(503).retryable).toBe(true);
    expect(fromHttpStatus(400).retryable).toBe(false); expect(fromHttpStatus(401).code).toBe('auth_failed');
  });
  it('safeError never leaks a token from an error message', () => {
    expect(safeError(new Error('failed with access_token=EAAverysecretvalue123456789012')).message).not.toContain('verysecret');
  });
});

describe('retry mechanism', () => {
  it('retries transient errors, then succeeds', async () => {
    let n = 0;
    const r = await withRetry(async () => { if (++n < 3) throw fromHttpStatus(503); return 'ok'; }, { sleep: async () => {} });
    expect(r).toBe('ok'); expect(n).toBe(3);
  });
  it('does not retry permanent errors', async () => {
    let n = 0;
    await expect(withRetry(async () => { n++; throw fromHttpStatus(400); }, { sleep: async () => {} })).rejects.toThrow();
    expect(n).toBe(1);
  });
  it('gives up after the retry budget', async () => {
    let n = 0;
    await expect(withRetry(async () => { n++; throw fromHttpStatus(429); }, { retries: 2, sleep: async () => {} })).rejects.toThrow();
    expect(n).toBe(3);
  });
  it('backoff is capped and jittered', () => {
    expect(backoffMs(20, 500, 60_000, () => 1)).toBe(60_000); expect(backoffMs(2, 500, 60_000, () => 0.5)).toBe(1000);
  });
});

describe('file type detection by content', () => {
  const binStl = (tris: number) => { const b = Buffer.alloc(84 + tris * 50); b.writeUInt32LE(tris, 80); return b; };
  it('accepts real STL/3MF/PDF/PNG/JPG/MP4 signatures', () => {
    expect(sniff(binStl(2))).toBe('stl');
    expect(sniff(Buffer.from('solid cube\n facet normal 0 0 1\n endfacet\nendsolid cube\n'))).toBe('stl');
    expect(sniff(Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.from('....3D/3dmodel.model....')]))).toBe('3mf');
    expect(sniff(Buffer.from('%PDF-1.7\n'))).toBe('pdf');
    expect(sniff(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('png');
    expect(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg');
    expect(sniff(Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom')]))).toBe('mp4');
  });
  it('rejects executables, plain zips and truncated STL even if renamed', () => {
    expect(sniff(Buffer.from('MZ\x90\x00 this is an exe'))).toBeNull();
    expect(sniff(Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.from('evil.exe')]))).toBeNull();
    expect(sniff(binStl(2).subarray(0, 120))).toBeNull();
    expect(sniff(Buffer.from('<script>alert(1)</script>'))).toBeNull();
  });
  it('blocks path traversal in storage keys', () => {
    for (const k of ['../etc/passwd', '/etc/passwd', 'a/../../x.stl', 'a\\b.stl', '..', 'x']) expect(() => keyPath(k)).toThrow();
    expect(keyPath('2026/11/abc.stl')).toContain('2026');
  });
});

describe('Meta webhook signature (X-Hub-Signature-256)', () => {
  const secret = 'app-secret-xyz'; const body = '{"object":"instagram","entry":[]}';
  const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  it('accepts the exact body', () => expect(verifyMetaSignature(body, sig, secret)).toBe(true));
  it('rejects tampering, wrong secret, missing prefix, garbage', () => {
    expect(verifyMetaSignature(body + ' ', sig, secret)).toBe(false);
    expect(verifyMetaSignature(body, sig, 'other')).toBe(false);
    expect(verifyMetaSignature(body, sig.slice(7), secret)).toBe(false);
    expect(verifyMetaSignature(body, 'sha256=zz', secret)).toBe(false);
    expect(verifyMetaSignature(body, null, secret)).toBe(false);
  });
});
