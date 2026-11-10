/**
 * Token-bucket rate limiter behind an interface so the in-memory implementation (single instance,
 * development) can be replaced by a shared store (Redis/Upstash) in production without touching callers.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimiter {
  consume(key: string, cost?: number): Promise<RateLimitResult>;
}

export function createMemoryRateLimiter(opts: { capacity: number; refillPerSecond: number; now?: () => number; maxKeys?: number }): RateLimiter {
  const buckets = new Map<string, { tokens: number; updated: number }>();
  const now = opts.now ?? Date.now;
  const maxKeys = opts.maxKeys ?? 50_000;
  return {
    async consume(key, cost = 1) {
      const t = now();
      let b = buckets.get(key);
      if (!b) {
        if (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value!);
        b = { tokens: opts.capacity, updated: t };
        buckets.set(key, b);
      }
      b.tokens = Math.min(opts.capacity, b.tokens + ((t - b.updated) / 1000) * opts.refillPerSecond);
      b.updated = t;
      if (b.tokens >= cost) {
        b.tokens -= cost;
        return { allowed: true, remaining: Math.floor(b.tokens), retryAfterMs: 0 };
      }
      return { allowed: false, remaining: 0, retryAfterMs: Math.ceil(((cost - b.tokens) / opts.refillPerSecond) * 1000) };
    },
  };
}
