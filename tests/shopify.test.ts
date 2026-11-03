import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { createHmac } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { verifyWebhook, claimWebhook } from '@/lib/shopify/webhook';
import { adminQuery, ShopifyError, getAdminToken } from '@/lib/shopify/client';
import { connectionStatus } from '@/lib/shopify/status';
import { shopDomain } from '@/lib/shopify/config';

const ENV = ['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_CLIENT_ID', 'SHOPIFY_CLIENT_SECRET'] as const;
let saved: Record<string, string | undefined> = {};
beforeEach(() => { saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]])); });
afterEach(() => { for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });
const setEnv = (domain = 'svqei9-ch.myshopify.com') => { process.env.SHOPIFY_STORE_DOMAIN = domain; process.env.SHOPIFY_CLIENT_ID = 'test-client-id'; process.env.SHOPIFY_CLIENT_SECRET = 'test-secret-value'; };

describe('webhook HMAC verification', () => {
  const secret = 'hook-secret-123';
  const body = '{"id":1001,"financial_status":"paid"}';
  const sig = createHmac('sha256', secret).update(body, 'utf8').digest('base64');
  it('accepts the correct signature', () => expect(verifyWebhook(body, sig, secret)).toBe(true));
  it('rejects a tampered body', () => expect(verifyWebhook(body.replace('1001', '1002'), sig, secret)).toBe(false));
  it('rejects a wrong secret', () => expect(verifyWebhook(body, sig, 'other')).toBe(false));
  it('rejects a missing header or secret', () => { expect(verifyWebhook(body, null, secret)).toBe(false); expect(verifyWebhook(body, sig, '')).toBe(false); });
  it('rejects garbage signatures without throwing', () => expect(verifyWebhook(body, '%%%', secret)).toBe(false));
});

describe('read-only Admin API guard (no network needed)', () => {
  it('refuses any mutation before sending a request', async () => {
    setEnv();
    let called = false;
    const f = async () => { called = true; return new Response('{}'); };
    await expect(adminQuery('mutation { productUpdate(input: {id: "x"}) { product { id } } }', {}, f)).rejects.toMatchObject({ code: 'write_blocked' });
    expect(called).toBe(false);
  });
});

describe('connection status (mocked network: logic only, NOT a real connection test)', () => {
  it('reports not_configured with the missing names and no values', async () => {
    delete process.env.SHOPIFY_STORE_DOMAIN; delete process.env.SHOPIFY_CLIENT_ID; delete process.env.SHOPIFY_CLIENT_SECRET;
    const s = await connectionStatus(async () => { throw new Error('should not be called'); });
    expect(s.state).toBe('not_configured');
    expect(JSON.stringify(s)).not.toContain('secret');
  });
  it('uses client credentials, then a read-only shop query', async () => {
    setEnv();
    const calls: { url: string; body?: string; headers?: Record<string, string> }[] = [];
    const f = async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body as string, headers: init?.headers as Record<string, string> });
      if (url.endsWith('/oauth/access_token')) return new Response(JSON.stringify({ access_token: 'tok-abc', expires_in: 86399 }), { status: 200 });
      return new Response(JSON.stringify({ data: { shop: { name: 'HX Dev', myshopifyDomain: 'svqei9-ch.myshopify.com' } } }), { status: 200 });
    };
    const s = await connectionStatus(f);
    expect(s).toMatchObject({ state: 'connected', shopName: 'HX Dev', domain: 'svqei9-ch.myshopify.com' });
    expect(calls[0].url).toBe('https://svqei9-ch.myshopify.com/admin/oauth/access_token');
    expect(String(calls[0].body)).toContain('grant_type=client_credentials');
    expect(calls[1].url).toMatch(/\/admin\/api\/2025-10\/graphql\.json$/);
    expect(calls[1].headers?.['X-Shopify-Access-Token']).toBe('tok-abc');
    expect(JSON.stringify(s)).not.toContain('test-secret-value');
    expect(JSON.stringify(s)).not.toContain('tok-abc');
  });
  it('a rejected token gives auth_failed without the response body', async () => {
    setEnv();
    const f = async () => new Response('{"error":"invalid_client test-secret-value"}', { status: 401 });
    const s = await connectionStatus(f);
    expect(s).toEqual({ state: 'auth_failed' });
    expect(JSON.stringify(s)).not.toContain('test-secret-value');
  });
  it('a network failure gives unreachable', async () => {
    setEnv();
    const s = await connectionStatus(async () => { throw new TypeError('fetch failed'); });
    expect(s.state).toBe('unreachable');
  });
  it('rejects a domain that is not a myshopify.com store', () => {
    process.env.SHOPIFY_STORE_DOMAIN = 'evil.example.com'; expect(shopDomain()).toBeNull();
    process.env.SHOPIFY_STORE_DOMAIN = 'svqei9-ch.myshopify.com'; expect(shopDomain()).toBe('svqei9-ch.myshopify.com');
  });
  it('caches the token in memory and reuses it', async () => {
    setEnv('cache-test.myshopify.com');
    let tokenCalls = 0;
    const f = async (url: string) => { if (url.endsWith('/oauth/access_token')) { tokenCalls++; return new Response(JSON.stringify({ access_token: 'm', expires_in: 86399 })); } return new Response('{}'); };
    await getAdminToken(f); await getAdminToken(f);
    expect(tokenCalls).toBe(1);
  });
});

const run = process.env.DATABASE_URL ? describe : describe.skip;
const db = new PrismaClient();
run('webhook idempotency (real database)', () => {
  afterAll(async () => { await db.webhookEvent.deleteMany({ where: { id: { startsWith: 'test-wh-' } } }); await db.$disconnect(); });
  it('the first delivery is new, a redelivery of the same id is a duplicate', async () => {
    const id = 'test-wh-' + Date.now();
    expect(await claimWebhook(db, id, 'orders/paid')).toBe('new');
    expect(await claimWebhook(db, id, 'orders/paid')).toBe('duplicate');
    expect(await db.webhookEvent.count({ where: { id } })).toBe(1);
  });
});
void ShopifyError;
