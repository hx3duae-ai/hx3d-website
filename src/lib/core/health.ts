/**
 * API Connection Health. A check never sends anything on behalf of customers and never spends money.
 * 'unverified' = credentials are present but no real call has proven them yet (said plainly in the UI).
 */
import type { PrismaClient } from '@prisma/client';
import { connectionStatus } from '../shopify/status';
import { INTEGRATIONS, recordHealth, type IntegrationKey } from './integrations';
import { secretStatus } from './secrets';
import { storageHealth } from './storage';
import { safeError } from './errors';
import { notify } from './notifications';

export type Health = { status: 'ok' | 'not_configured' | 'unverified' | 'error'; detail?: string };
type FetchLike = (u: string, i?: RequestInit) => Promise<Response>;

async function secretsPresent(db: PrismaClient, key: IntegrationKey) {
  const defs = INTEGRATIONS[key].secrets;
  const vault = await secretStatus(db, defs.map((d) => d.name));
  const missing = defs.filter((d, i) => !vault[i].configured && !(d.env && process.env[d.env]?.trim())).map((d) => d.label);
  return missing;
}

export async function checkIntegration(db: PrismaClient, key: IntegrationKey, fetchImpl: FetchLike = fetch): Promise<Health> {
  try {
    switch (key) {
      case 'shopify': {
        const s = await connectionStatus(fetchImpl);
        if (s.state === 'connected') return { status: 'ok', detail: `${s.shopName} (${s.domain}) — read-only` };
        if (s.state === 'not_configured') return { status: 'not_configured', detail: s.missing.join(', ') };
        return { status: 'error', detail: s.state };
      }
      case 'hx_studio': {
        const base = process.env.HX_STUDIO_URL?.trim(); if (!base) return { status: 'not_configured', detail: 'HX_STUDIO_URL' };
        const r = await fetchImpl(`${base.replace(/\/$/, '')}/api/capabilities`, { signal: AbortSignal.timeout(5000) });
        return r.ok ? { status: 'ok', detail: 'capabilities endpoint answered' } : { status: 'error', detail: `HTTP ${r.status}` };
      }
      case 'storage': return (await storageHealth()).ok ? { status: 'ok', detail: 'local private storage writable' } : { status: 'error', detail: 'storage directory not writable' };
      default: {
        const missing = await secretsPresent(db, key);
        if (missing.length) return { status: 'not_configured', detail: missing.join(', ') };
        return { status: 'unverified', detail: 'credentials present; no real API call has verified them yet' };
      }
    }
  } catch (e) { return { status: 'error', detail: safeError(e).message }; }
}

export async function runHealthChecks(db: PrismaClient, keys: IntegrationKey[], fetchImpl?: FetchLike) {
  const out: Record<string, Health> = {};
  for (const k of keys) {
    const h = await checkIntegration(db, k, fetchImpl); out[k] = h;
    await recordHealth(db, k, h.status, h.detail);
    if (h.status === 'error') await notify(db, { level: 'error', source: k, title: `${INTEGRATIONS[k].name.en}: connection error`, body: h.detail, actionRequired: true, dedupeKey: `health:${k}` });
  }
  return out;
}

export async function dbHealth(db: PrismaClient) {
  const t = performance.now();
  try { await db.$queryRaw`SELECT 1`; return { ok: true, latencyMs: Math.round(performance.now() - t) }; }
  catch { return { ok: false, latencyMs: null }; }
}
