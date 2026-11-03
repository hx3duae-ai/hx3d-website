/**
 * Shopify configuration. Secrets are read from the environment only (server side).
 * Nothing in this file is ever returned to the browser or written to logs.
 */
export const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-10';

/** Read-only scopes only. Write scopes are not requested until they are approved. */
export const SHOPIFY_SCOPES = ['read_products', 'read_inventory'] as const;

const DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export function shopDomain(): string | null {
  const d = (process.env.SHOPIFY_STORE_DOMAIN ?? '').trim().toLowerCase();
  return DOMAIN_RE.test(d) ? d : null;
}

export function shopifyCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = (process.env.SHOPIFY_CLIENT_ID ?? '').trim();
  const clientSecret = (process.env.SHOPIFY_CLIENT_SECRET ?? '').trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function webhookSecret(): string | null {
  const s = (process.env.SHOPIFY_WEBHOOK_SECRET ?? '').trim();
  return s || null;
}
