import { isRetryable } from './errors';

export type RetryOptions = { retries?: number; baseMs?: number; maxMs?: number; retryOn?: (e: unknown) => boolean; sleep?: (ms: number) => Promise<void>; random?: () => number };

/** Exponential backoff with full jitter: delay = random(0, min(maxMs, baseMs * 2^attempt)). */
export function backoffMs(attempt: number, baseMs = 500, maxMs = 60_000, random = Math.random): number {
  const cap = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
  return Math.round(random() * cap);
}

/** Retries transient failures only (429, 5xx, network). Permanent errors are thrown immediately. */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, o: RetryOptions = {}): Promise<T> {
  const retries = o.retries ?? 3; const retryOn = o.retryOn ?? isRetryable;
  const sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  for (let attempt = 0; ; attempt++) {
    try { return await fn(attempt); }
    catch (e) {
      if (attempt >= retries || !retryOn(e)) throw e;
      await sleep(backoffMs(attempt, o.baseMs, o.maxMs, o.random));
    }
  }
}
