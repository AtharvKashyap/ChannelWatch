import type { Context, MiddlewareHandler } from "hono";
import type postgres from "postgres";
import { clientIp } from "./middleware.js";
import { getSql } from "../db/client.js";

/**
 * Per-IP rate limiting (SPEC §17 middleware; §32.1/§32.6 abuse controls).
 *
 * Two interchangeable stores implement one `RateLimitStore` interface:
 *
 * - `TokenBucketStore` — the default. In-memory, per-process, clock-injectable,
 *   with NO Hono dependency so it is unit-testable in isolation. Fine for dev
 *   and single-instance deployments.
 * - `PostgresFixedWindowStore` — a DURABLE store selected by
 *   `RATE_LIMIT_STORE=postgres`. Fixed-window counters live in the
 *   `rate_limit_counters` table, so limits survive restarts and are shared
 *   across every instance pointed at the same database. This closes the
 *   horizontal-scale gap (launch checklist §5.3) WITHOUT adding Redis.
 *
 * `createRateLimit` picks the store from config/env and wraps it as Hono
 * middleware that keys on the client IP, records the outcome on the context (so
 * the request logger / metrics can see it), and emits the standard RateLimit
 * headers (IETF draft: `RateLimit-Limit` / `RateLimit-Remaining` /
 * `RateLimit-Reset`, plus `Retry-After` on a 429).
 */

/** Context key under which the rate-limit outcome is recorded for observability. */
export const RATE_LIMIT_OUTCOME_KEY = "rateLimitOutcome";

declare module "hono" {
  interface ContextVariableMap {
    // "allowed" | "limited", or absent on paths with no rate limiter. Keyed by
    // the literal value of RATE_LIMIT_OUTCOME_KEY.
    rateLimitOutcome?: "allowed" | "limited";
  }
}

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
  /**
   * Evict a bucket after this many ms of inactivity (default 10 min). A bucket
   * idle this long has necessarily refilled to full capacity, so dropping it is
   * behaviourally identical to keeping it — it just reclaims memory.
   */
  idleMs?: number;
  /**
   * Hard cap on the number of tracked buckets (default 10_000). When exceeded,
   * the least-recently-used buckets are evicted. Bounds memory under a
   * distributed / spoofed-key flood so the store cannot grow without limit.
   */
  maxKeys?: number;
  /** Injectable clock (ms). Defaults to `Date.now`; tests pass a fake. */
  now?: () => number;
}

/**
 * A rate-limit store: given a key, decide whether to admit one more request.
 * `take` may be synchronous (in-memory) or asynchronous (Postgres); the
 * middleware always awaits it, so both are interchangeable.
 */
export interface RateLimitStore {
  take(key: string): RateLimitDecision | Promise<RateLimitDecision>;
}

interface Bucket {
  tokens: number;
  last: number;
}

export class TokenBucketStore implements RateLimitStore {
  private readonly capacity: number;
  private readonly ratePerMs: number;
  private readonly idleMs: number;
  private readonly maxKeys: number;
  private readonly now: () => number;
  // Insertion/access order is maintained as LRU: every `take` deletes and
  // re-sets its key so the map is ordered oldest-access-first. That lets idle
  // sweeping stop at the first fresh entry and LRU eviction drop from the front.
  private readonly buckets = new Map<string, Bucket>();

  constructor(options: TokenBucketOptions) {
    if (options.capacity <= 0) throw new Error("rate-limit capacity must be > 0");
    if (options.refillWindowMs <= 0) throw new Error("rate-limit refillWindowMs must be > 0");
    if (options.idleMs !== undefined && options.idleMs <= 0)
      throw new Error("rate-limit idleMs must be > 0");
    if (options.maxKeys !== undefined && options.maxKeys <= 0)
      throw new Error("rate-limit maxKeys must be > 0");
    this.capacity = options.capacity;
    this.ratePerMs = options.capacity / options.refillWindowMs;
    this.idleMs = options.idleMs ?? 10 * 60 * 1000;
    this.maxKeys = options.maxKeys ?? 10_000;
    this.now = options.now ?? Date.now;
  }

  /**
   * Attempt to spend one token for `key`. Refills lazily based on elapsed time
   * since the key was last seen, capped at capacity. A request is allowed iff a
   * whole token is available. Also sweeps idle buckets and enforces the LRU cap.
   */
  take(key: string): RateLimitDecision {
    const now = this.now();
    this.sweepIdle(now);

    // Pull + delete so the re-set below moves the key to the most-recent end.
    const existing = this.buckets.get(key);
    if (existing) this.buckets.delete(key);
    const bucket = existing ?? { tokens: this.capacity, last: now };

    // Lazy refill for the elapsed interval, capped at capacity.
    const elapsed = Math.max(0, now - bucket.last);
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.ratePerMs);
    bucket.last = now;

    const allowed = bucket.tokens >= 1;
    if (allowed) bucket.tokens -= 1;
    this.buckets.set(key, bucket);
    this.evictOverflow();

    const remaining = Math.max(0, Math.floor(bucket.tokens));
    // Time to fully refill from the current level.
    const resetSeconds = Math.ceil((this.capacity - bucket.tokens) / this.ratePerMs / 1000);
    // Time until the next whole token exists (0 when a token was granted).
    const deficit = allowed ? 0 : 1 - bucket.tokens;
    const retryAfterSeconds = allowed ? 0 : Math.ceil(deficit / this.ratePerMs / 1000);

    return { allowed, limit: this.capacity, remaining, resetSeconds, retryAfterSeconds };
  }

  /** Number of tracked buckets (for tests/introspection). */
  size(): number {
    return this.buckets.size;
  }

  /** Drop buckets untouched for longer than `idleMs`. Map is oldest-first. */
  private sweepIdle(now: number): void {
    const cutoff = now - this.idleMs;
    for (const [k, b] of this.buckets) {
      if (b.last > cutoff) break; // rest are newer (access-ordered)
      this.buckets.delete(k);
    }
  }

  /** Evict least-recently-used buckets until at/under the cap. */
  private evictOverflow(): void {
    while (this.buckets.size > this.maxKeys) {
      const oldest = this.buckets.keys().next().value;
      if (oldest === undefined) break;
      this.buckets.delete(oldest);
    }
  }

  /** Test/maintenance helper: drop all buckets. */
  reset(): void {
    this.buckets.clear();
  }
}

type Sql = ReturnType<typeof postgres>;

export interface PostgresFixedWindowOptions {
  /** Maximum requests admitted per window (== the per-window limit). */
  capacity: number;
  /** Fixed-window length in milliseconds. */
  windowMs: number;
  /**
   * Limiter label, stored in the `scope` column so the shared table cannot let
   * one limiter's traffic drain another's budget (e.g. "read", "post", "login").
   */
  scope: string;
  /**
   * Injectable postgres-js client (tests pass their own). Defaults to the shared
   * lazy client via `getSql()`, resolved on first `take` — NOT in the
   * constructor — so building the middleware never opens a socket.
   */
  sql?: Sql;
  /** Injectable clock (ms). Defaults to `Date.now`; tests pass a fake. */
  now?: () => number;
  /**
   * Probability [0,1] that a `take` also sweeps expired rows. Opportunistic
   * cleanup keeps the table bounded without a scheduler; a periodic
   * `sweepExpired()` call is also supported. Default 0.02 (~1 sweep per 50
   * requests). Set 0 to disable opportunistic cleanup (e.g. deterministic tests).
   */
  cleanupProbability?: number;
}

/**
 * Durable, shared, fixed-window rate-limit store backed by `rate_limit_counters`.
 *
 * Each `take` runs ONE atomic upsert (`INSERT … ON CONFLICT DO UPDATE …
 * RETURNING count`) that both creates the window row and increments it, so
 * concurrent requests across instances increment the same counter without a
 * read-modify-write race. Fixed-window (not token-bucket) semantics are used
 * deliberately: they need no per-request refill math and map cleanly to a single
 * upsert. A request is admitted while the post-increment count is ≤ capacity.
 */
export class PostgresFixedWindowStore implements RateLimitStore {
  private readonly capacity: number;
  private readonly windowMs: number;
  private readonly scope: string;
  private readonly injectedSql?: Sql;
  private readonly now: () => number;
  private readonly cleanupProbability: number;

  constructor(options: PostgresFixedWindowOptions) {
    if (options.capacity <= 0) throw new Error("rate-limit capacity must be > 0");
    if (options.windowMs <= 0) throw new Error("rate-limit windowMs must be > 0");
    if (
      options.cleanupProbability !== undefined &&
      (options.cleanupProbability < 0 || options.cleanupProbability > 1)
    ) {
      throw new Error("rate-limit cleanupProbability must be within [0, 1]");
    }
    this.capacity = options.capacity;
    this.windowMs = options.windowMs;
    this.scope = options.scope;
    this.injectedSql = options.sql;
    this.now = options.now ?? Date.now;
    this.cleanupProbability = options.cleanupProbability ?? 0.02;
  }

  private sql(): Sql {
    return this.injectedSql ?? getSql();
  }

  async take(key: string): Promise<RateLimitDecision> {
    const now = this.now();
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    const windowEnd = windowStart + this.windowMs;
    const sql = this.sql();

    const rows = await sql<{ count: number }[]>`
      insert into rate_limit_counters (scope, bucket_key, window_start, count, expires_at)
      values (${this.scope}, ${key}, ${windowStart}, 1, ${new Date(windowEnd).toISOString()})
      on conflict (scope, bucket_key, window_start)
      do update set count = rate_limit_counters.count + 1
      returning count
    `;
    const count = Number(rows[0]?.count ?? 1);

    // Opportunistic TTL cleanup — best-effort, never fails the request.
    if (this.cleanupProbability > 0 && Math.random() < this.cleanupProbability) {
      void this.sweepExpired(now).catch(() => {});
    }

    const allowed = count <= this.capacity;
    const remaining = Math.max(0, this.capacity - count);
    const resetSeconds = Math.max(0, Math.ceil((windowEnd - now) / 1000));
    const retryAfterSeconds = allowed ? 0 : resetSeconds;
    return { allowed, limit: this.capacity, remaining, resetSeconds, retryAfterSeconds };
  }

  /** Delete windows that have fully expired. Returns the number of rows removed. */
  async sweepExpired(nowMs?: number): Promise<number> {
    const sql = this.sql();
    const cutoff = new Date(nowMs ?? this.now()).toISOString();
    const result = await sql`delete from rate_limit_counters where expires_at <= ${cutoff}`;
    return result.count ?? 0;
  }
}

/** Which rate-limit store backs a limiter. */
export type RateLimitStoreKind = "memory" | "postgres";

/**
 * Resolve the store kind: an explicit config value wins; otherwise
 * `RATE_LIMIT_STORE=postgres` selects the durable store; anything else (unset,
 * "memory", …) keeps the in-memory default so dev and tests need no database.
 */
export function resolveRateLimitStoreKind(explicit?: RateLimitStoreKind): RateLimitStoreKind {
  if (explicit) return explicit;
  return process.env.RATE_LIMIT_STORE?.trim().toLowerCase() === "postgres" ? "postgres" : "memory";
}

export interface RateLimitConfig extends TokenBucketOptions {
  /**
   * Limiter label used by the Postgres store to isolate this limiter's counters
   * in the shared table. Ignored by the in-memory store. Defaults to "default".
   */
  scope?: string;
  /** Force a specific store. Defaults to `resolveRateLimitStoreKind()` (env-driven). */
  store?: RateLimitStoreKind;
}

/** Apply the standard RateLimit headers of a decision to a response context. */
export function applyRateLimitHeaders(c: Context, decision: RateLimitDecision): void {
  c.header("RateLimit-Limit", String(decision.limit));
  c.header("RateLimit-Remaining", String(decision.remaining));
  c.header("RateLimit-Reset", String(decision.resetSeconds));
}

/**
 * Build a Hono middleware enforcing `capacity` requests per `refillWindowMs` per
 * client IP. Reads use 60/min, POSTs 5/min (per the adjudicated design). The
 * backing store is chosen from config/env (in-memory by default; Postgres when
 * `RATE_LIMIT_STORE=postgres`) behind ONE middleware interface, so callers and
 * existing behavior are unchanged. On a breach it short-circuits with a 429 JSON
 * error envelope and `Retry-After`. The outcome is recorded on the context under
 * `RATE_LIMIT_OUTCOME_KEY` for the request logger / metrics.
 */
export function createRateLimit(options: RateLimitConfig): MiddlewareHandler {
  const scope = options.scope ?? "default";
  const store: RateLimitStore =
    resolveRateLimitStoreKind(options.store) === "postgres"
      ? new PostgresFixedWindowStore({
          capacity: options.capacity,
          windowMs: options.refillWindowMs,
          scope,
          now: options.now,
        })
      : new TokenBucketStore(options);

  return async (c, next) => {
    const decision = await store.take(clientIp(c));
    applyRateLimitHeaders(c, decision);
    c.set(RATE_LIMIT_OUTCOME_KEY, decision.allowed ? "allowed" : "limited");
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
