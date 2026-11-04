/**
 * Integration Manager: one registry for every external connection, a mode per integration
 * (disabled / dry_run / test / live), a global kill switch, and a single policy gate that every
 * system must call before it reads, sends, publishes or spends.
 */
import type { PrismaClient, IntegrationMode } from '@prisma/client';
import { HxError } from './errors';

export type IntegrationKey = 'shopify' | 'meta_messaging' | 'meta_ads' | 'najm_llm' | 'hx_studio' | 'storage';
export type Action = 'read' | 'write' | 'send' | 'spend';

export type IntegrationDef = {
  key: IntegrationKey;
  system: 'core' | 'shop' | 'social' | 'marketing' | 'najm' | 'reels';
  name: { ar: string; en: string };
  /** Secret names (vault) and the env var each may also come from. */
  secrets: { name: string; env?: string; label: string; envOnly?: boolean }[];
  /** Actions this integration may ever perform. Anything else is refused even in live mode. */
  allowed: readonly Action[];
  docs?: string;
};

export const INTEGRATIONS: Record<IntegrationKey, IntegrationDef> = {
  shopify: { key: 'shopify', system: 'shop', name: { ar: 'متجر Shopify', en: 'Shopify store' }, allowed: ['read'],
    // envOnly: the existing Shopify client reads these from the server environment; moving them to the vault is part of the Shopify connection phase.
    secrets: [{ name: 'shopify.client_id', env: 'SHOPIFY_CLIENT_ID', label: 'Client ID', envOnly: true }, { name: 'shopify.client_secret', env: 'SHOPIFY_CLIENT_SECRET', label: 'Client secret', envOnly: true },
      { name: 'shopify.webhook_secret', env: 'SHOPIFY_WEBHOOK_SECRET', label: 'Webhook secret' }] },
  meta_messaging: { key: 'meta_messaging', system: 'social', name: { ar: 'Meta: الرسائل والتعليقات', en: 'Meta: messages & comments' }, allowed: ['read', 'send'],
    secrets: [{ name: 'meta.app_secret', env: 'META_APP_SECRET', label: 'App secret (webhook signatures)' }, { name: 'meta.webhook_verify_token', env: 'META_WEBHOOK_VERIFY_TOKEN', label: 'Webhook verify token' },
      { name: 'meta.page_token', label: 'Page / Instagram access token (from OAuth)' }] },
  meta_ads: { key: 'meta_ads', system: 'marketing', name: { ar: 'Meta: الإعلانات (منفصل)', en: 'Meta: ads (separate)' }, allowed: ['read', 'write', 'spend'],
    secrets: [{ name: 'meta_ads.system_user_token', label: 'System user token (ads_read)' }] },
  najm_llm: { key: 'najm_llm', system: 'najm', name: { ar: 'عقل نجم (LLM)', en: 'NAJM brain (LLM)' }, allowed: ['read', 'send'],
    secrets: [{ name: 'najm.llm_api_key', env: 'ANTHROPIC_API_KEY', label: 'LLM API key' }] },
  hx_studio: { key: 'hx_studio', system: 'reels', name: { ar: 'محرك HX Studio (فيديو و3D)', en: 'HX Studio engine (video & 3D)' }, allowed: ['read', 'write'],
    secrets: [{ name: 'hx_studio.shared_secret', env: 'HX_STUDIO_SHARED_SECRET', label: 'Shared request-signing secret' }] },
  storage: { key: 'storage', system: 'core', name: { ar: 'تخزين الملفات', en: 'File storage' }, allowed: ['read', 'write'], secrets: [] },
};
export const integrationKeys = Object.keys(INTEGRATIONS) as IntegrationKey[];
export const isIntegrationKey = (k: string): k is IntegrationKey => k in INTEGRATIONS;


export async function getState(db: Pick<PrismaClient, 'integration'>, key: IntegrationKey) {
  return db.integration.upsert({ where: { key }, create: { key }, update: {} });
}
export async function allStates(db: Pick<PrismaClient, 'integration'>) {
  return Promise.all(integrationKeys.map((k) => getState(db, k)));
}

const KILL = 'core.kill_switch';
export async function killSwitchOn(db: Pick<PrismaClient, 'integration'>) {
  const r = await db.integration.findUnique({ where: { key: KILL } });
  return !!r?.enabled;
}
export async function setKillSwitch(db: Pick<PrismaClient, 'integration'>, on: boolean) {
  await db.integration.upsert({ where: { key: KILL }, create: { key: KILL, enabled: on, mode: 'disabled', status: on ? 'engaged' : 'off' }, update: { enabled: on, status: on ? 'engaged' : 'off' } });
}

/**
 * The policy gate. Returns 'execute' (do it for real) or 'simulate' (dry run: log what would happen),
 * or throws HxError('policy_blocked'|'disabled').
 *  - read:  needs enabled + any mode except disabled (dry_run reads are allowed: they change nothing)
 *  - write/send: dry_run → simulate; test/live → execute
 *  - spend: only live with a recorded owner approval, never via dry_run/test
 */
export async function gate(db: Pick<PrismaClient, 'integration'>, key: IntegrationKey, action: Action): Promise<'execute' | 'simulate'> {
  const def = INTEGRATIONS[key];
  if (!def.allowed.includes(action)) throw new HxError('policy_blocked', `${key} may not ${action}`);
  if (action !== 'read' && await killSwitchOn(db)) throw new HxError('policy_blocked', 'global kill switch is engaged');
  const s = await getState(db, key);
  if (!s.enabled || s.mode === 'disabled') throw new HxError('disabled', `${key} is disabled`);
  if (action === 'read') return 'execute';
  if (action === 'spend') {
    if (s.mode !== 'live' || !s.liveApprovedAt) throw new HxError('policy_blocked', 'spending needs live mode with owner approval');
    return 'execute';
  }
  if (s.mode === 'dry_run') return 'simulate';
  if (s.mode === 'live' && !s.liveApprovedAt) throw new HxError('policy_blocked', 'live mode has no recorded approval');
  return 'execute';
}

/** Mode changes. Going live requires the integrations.live permission (checked by the caller) and records who approved. */
export async function setMode(db: Pick<PrismaClient, 'integration'>, key: IntegrationKey, mode: IntegrationMode, actorId: string) {
  const live = mode === 'live';
  return db.integration.upsert({ where: { key }, create: { key, mode, liveApprovedBy: live ? actorId : null, liveApprovedAt: live ? new Date() : null },
    update: { mode, liveApprovedBy: live ? actorId : null, liveApprovedAt: live ? new Date() : null } });
}
export async function setEnabled(db: Pick<PrismaClient, 'integration'>, key: IntegrationKey, enabled: boolean) {
  return db.integration.upsert({ where: { key }, create: { key, enabled }, update: { enabled } });
}
export async function recordHealth(db: Pick<PrismaClient, 'integration'>, key: IntegrationKey, status: string, detail?: string) {
  const now = new Date();
  return db.integration.upsert({ where: { key }, create: { key, status, statusDetail: detail ?? null, lastCheckAt: now, lastOkAt: status === 'ok' ? now : null },
    update: { status, statusDetail: detail ?? null, lastCheckAt: now, ...(status === 'ok' ? { lastOkAt: now } : {}) } });
}
