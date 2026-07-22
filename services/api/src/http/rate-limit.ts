import type { Context, MiddlewareHandler } from "hono";
import { clientIp } from "./middleware.js";

/**
 * In-memory per-IP token-bucket rate limiting (SPEC §17 middleware; §32.1/§32.6
 * abuse controls). Single-instance MVP: the buckets live in this process's
 * memory, so a multi-instance deployment would need a shared store (Redis) —
 * documented here as a known limitation, not a bug.
 *
 * The `TokenBucketStore` is a pure, clock-injectable data structure with NO Hono
 * dependency so it is unit-testable in isolation; `createRateLimit` wraps it as
 * Hono middleware that keys on the client IP and emits the standard RateLimit
 * headers (IETF draft: `RateLimit-Limit` / `RateLimit-Remaining` /
 * `RateLimit-Reset`, plus `Retry-After` on a 429).
 */

export interface RateLimitDecision {
  allowed: boolean;
  /** Bucket capacity (the configured limit). */
  limit: number;
  /** Whole tokens left after this request. */
  remaining: number;
  /** Seconds until the bucket is completely refilled. */
  resetSeconds: number;
  /** Seconds until at least one token is available (0 when allowed). */
  retryAfterSeconds: number;
}

export interface TokenBucketOptions {
  /** Maximum tokens (== the per-window request limit). */
  capacity: number;
  /** Milliseconds in which `capacity` tokens are fully replenished. */
  refillWindowMs: number;
  /** Injectable clock (ms). Defaults to `Date.now`; tests pass a fake. */
  now?: () => number;
}

interface Bucket {
  tokens: number;
  last: number;
}

export class TokenBucketStore {
  private readonly capacity: number;
  private readonly ratePerMs: number;
  private readonly now: () => number;
  private readonly buckets = new Map<string, Bucket>();

  constructor(options: TokenBucketOptions) {
    if (options.capacity <= 0) throw new Error("rate-limit capacity must be > 0");
    if (options.refillWindowMs <= 0) throw new Error("rate-limit refillWindowMs must be > 0");
    this.capacity = options.capacity;
    this.ratePerMs = options.capacity / options.refillWindowMs;
    this.now = options.now ?? Date.now;
  }

  /**
   * Attempt to spend one token for `key`. Refills lazily based on elapsed time
   * since the key was last seen, capped at capacity. A request is allowed iff a
   * whole token is available.
   */
  take(key: string): RateLimitDecision {
    const now = this.now();
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, last: now };

    // Lazy refill for the elapsed interval, capped at capacity.
    const elapsed = Math.max(0, now - bucket.last);
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.ratePerMs);
    bucket.last = now;

    const allowed = bucket.tokens >= 1;
    if (allowed) bucket.tokens -= 1;
    this.buckets.set(key, bucket);

    const remaining = Math.max(0, Math.floor(bucket.tokens));
    // Time to fully refill from the current level.
    const resetSeconds = Math.ceil((this.capacity - bucket.tokens) / this.ratePerMs / 1000);
    // Time until the next whole token exists (0 when a token was granted).
    const deficit = allowed ? 0 : 1 - bucket.tokens;
    const retryAfterSeconds = allowed ? 0 : Math.ceil(deficit / this.ratePerMs / 1000);

    return { allowed, limit: this.capacity, remaining, resetSeconds, retryAfterSeconds };
  }

  /** Test/maintenance helper: drop all buckets. */
  reset(): void {
    this.buckets.clear();
  }
}

/** Apply the standard RateLimit headers of a decision to a response context. */
export function applyRateLimitHeaders(c: Context, decision: RateLimitDecision): void {
  c.header("RateLimit-Limit", String(decision.limit));
  c.header("RateLimit-Remaining", String(decision.remaining));
  c.header("RateLimit-Reset", String(decision.resetSeconds));
}

/**
 * Build a Hono middleware enforcing `capacity` requests per `refillWindowMs` per
 * client IP. Reads use 60/min, POSTs 5/min (per the adjudicated design). On a
 * breach it short-circuits with a 429 JSON error envelope and `Retry-After`.
 */
export function createRateLimit(options: TokenBucketOptions): MiddlewareHandler {
  const store = new TokenBucketStore(options);
  return async (c, next) => {
    const decision = store.take(clientIp(c));
    applyRateLimitHeaders(c, decision);
    if (!decision.allowed) {
      c.header("Retry-After", String(decision.retryAfterSeconds));
      return c.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Rate limit exceeded. Please retry after a short delay.",
          },
        },
        429,
      );
    }
    await next();
  };
}
