import { SHOPIFY_API_VERSION, shopDomain, shopifyCredentials } from './config';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class ShopifyError extends Error {
  constructor(public code: 'not_configured' | 'auth_failed' | 'request_failed' | 'write_blocked', msg?: string) {
    super(msg ?? code);
  }
}

// Token lives in memory only: never written to disk, Git, logs or the browser.
let cached: { token: string; expiresAt: number; domain: string } | null = null;

/** Client credentials grant (same-organisation app and store). Token is refreshed before it expires. */
export async function getAdminToken(fetchImpl: FetchLike = fetch): Promise<string> {
  const domain = shopDomain(); const creds = shopifyCredentials();
  if (!domain || !creds) throw new ShopifyError('not_configured');
  if (cached && cached.domain === domain && Date.now() < cached.expiresAt - 60_000) return cached.token;
  const res = await fetchImpl(`https://${domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: creds.clientId, client_secret: creds.clientSecret }),
  });
  if (!res.ok) throw new ShopifyError('auth_failed', `token HTTP ${res.status}`);
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new ShopifyError('auth_failed', 'no token in response');
  cached = { token: json.access_token, domain, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cached.token;
}

/**
 * GraphQL Admin API, READ ONLY in this phase: any mutation is refused before the request is sent.
 */
export async function adminQuery<T>(query: string, variables: Record<string, unknown> = {}, fetchImpl: FetchLike = fetch): Promise<T> {
  if (/\bmutation\b/i.test(query)) throw new ShopifyError('write_blocked', 'mutations are disabled in this phase');
  const domain = shopDomain(); if (!domain) throw new ShopifyError('not_configured');
  const token = await getAdminToken(fetchImpl);
  const res = await fetchImpl(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 401 || res.status === 403) { cached = null; throw new ShopifyError('auth_failed', `HTTP ${res.status}`); }
  if (!res.ok) throw new ShopifyError('request_failed', `HTTP ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (!json.data) throw new ShopifyError('request_failed', 'no data');
  return json.data;
}
