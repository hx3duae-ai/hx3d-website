import { shopDomain, shopifyCredentials, SHOPIFY_SCOPES } from './config';
import { adminQuery, ShopifyError, type FetchLike } from './client';

export type ConnectionStatus =
  | { state: 'not_configured'; missing: string[] }
  | { state: 'auth_failed' }
  | { state: 'unreachable' }
  | { state: 'connected'; shopName: string; domain: string; scopes: readonly string[] };

/** Safe status for the admin page: never includes the secret, the token or raw error bodies. */
export async function connectionStatus(fetchImpl?: FetchLike): Promise<ConnectionStatus> {
  const missing: string[] = [];
  if (!shopDomain()) missing.push('SHOPIFY_STORE_DOMAIN');
  if (!shopifyCredentials()) missing.push('SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET');
  if (missing.length) return { state: 'not_configured', missing };
  try {
    const d = await adminQuery<{ shop: { name: string; myshopifyDomain: string } }>('query { shop { name myshopifyDomain } }', {}, fetchImpl);
    return { state: 'connected', shopName: d.shop.name, domain: d.shop.myshopifyDomain, scopes: SHOPIFY_SCOPES };
  } catch (e) {
    if (e instanceof ShopifyError && e.code === 'auth_failed') return { state: 'auth_failed' };
    return { state: 'unreachable' };
  }
}
