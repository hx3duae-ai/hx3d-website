/**
 * Error handling shared by every HX system.
 * `HxError.code` is safe to show; `message` may contain internal detail and is only logged after redaction.
 */
export type HxErrorCode =
  | 'not_configured' | 'disabled' | 'forbidden' | 'invalid_input' | 'not_found' | 'conflict'
  | 'rate_limited' | 'upstream_unavailable' | 'upstream_rejected' | 'auth_failed' | 'policy_blocked' | 'internal';

export class HxError extends Error {
  constructor(public code: HxErrorCode, message?: string, public retryable = false, public status?: number) {
    super(message ?? code);
    this.name = 'HxError';
  }
}

/** Upstream HTTP status → our error (429 and 5xx are worth retrying, other 4xx are not). */
export function fromHttpStatus(status: number, what = 'upstream'): HxError {
  if (status === 401 || status === 403) return new HxError('auth_failed', `${what} HTTP ${status}`, false, status);
  if (status === 429) return new HxError('rate_limited', `${what} HTTP 429`, true, status);
  if (status >= 500) return new HxError('upstream_unavailable', `${what} HTTP ${status}`, true, status);
  return new HxError('upstream_rejected', `${what} HTTP ${status}`, false, status);
}

export function isRetryable(e: unknown): boolean {
  if (e instanceof HxError) return e.retryable;
  // network-level failures from fetch (DNS, reset, timeout) are transient
  return e instanceof TypeError || (e as { name?: string })?.name === 'AbortError';
}

const PATTERNS: [RegExp, string][] = [
  [/\b(EAA[A-Za-z0-9]{20,})/g, 'EAA…[redacted]'],                     // Meta access tokens
  [/\b(shp(at|ss|ca|pa)_[A-Za-z0-9]{10,})/g, 'shp…[redacted]'],       // Shopify tokens
  [/\b(sk-ant-[A-Za-z0-9_-]{10,})/g, 'sk-ant…[redacted]'],            // Anthropic keys
  [/\b(gh[pousr]_[A-Za-z0-9]{20,})/g, 'gh…[redacted]'],
  [/(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, '$1[redacted]'],
  [/((?:access_token|client_secret|app_secret|api[_-]?key|password|secret|token)["']?\s*[:=]\s*["']?)[^"'\s&,}]{4,}/gi, '$1[redacted]'],
];
/** Masks anything that looks like a credential before text is stored or displayed. */
export function redact(text: string): string {
  let t = String(text);
  for (const [re, rep] of PATTERNS) t = t.replace(re, rep);
  return t.slice(0, 2000);
}

/** Safe, user-facing summary of any error. Never includes stack traces or raw upstream bodies. */
export function safeError(e: unknown): { code: HxErrorCode; message: string } {
  if (e instanceof HxError) return { code: e.code, message: redact(e.message) };
  return { code: 'internal', message: redact((e as Error)?.message ?? String(e)) };
}
