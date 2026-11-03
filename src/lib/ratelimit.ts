/** Fixed-window failure limiter. In-memory: per server instance; move to the database before scaling out. */
export function createLimiter(max: number, windowMs: number) {
  const store = new Map<string, { count: number; reset: number }>();
  return {
    blocked(key: string) {
      const r = store.get(key); if (!r) return false;
      if (Date.now() > r.reset) { store.delete(key); return false; }
      return r.count >= max;
    },
    fail(key: string) {
      const now = Date.now(); const r = store.get(key);
      if (!r || now > r.reset) store.set(key, { count: 1, reset: now + windowMs }); else r.count++;
    },
    clear(key: string) { store.delete(key); },
  };
}
export const loginLimiter = createLimiter(5, 15 * 60 * 1000);
