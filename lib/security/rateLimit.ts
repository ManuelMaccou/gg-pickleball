// lib/security/rateLimit.ts
//
// Simple in-memory rate limiter. Sufficient for low-traffic signup endpoints
// on a single instance. If you scale to multiple Next.js instances, swap this
// for a Redis-backed limiter (Upstash, ioredis, etc.) — same API.

interface Entry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Entry>();

interface RateLimitOptions {
  /** Unique identifier (usually IP + route key) */
  key: string;
  /** Max requests allowed per window */
  limit: number;
  /** Window length in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

export function rateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count };
}

// Periodically prune expired entries to avoid memory growth.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets.entries()) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }, 60_000).unref?.();
}