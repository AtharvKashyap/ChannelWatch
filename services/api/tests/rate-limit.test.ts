import { describe, it, expect, afterEach } from "vitest";
import {
  PostgresFixedWindowStore,
  TokenBucketStore,
  resolveRateLimitStoreKind,
} from "../src/http/rate-limit.js";

/**
 * Pure unit tests for the token-bucket store — no HTTP, no DB. Time is injected
 * so refill behavior is deterministic.
 */

describe("TokenBucketStore", () => {
  it("allows up to capacity requests, then denies", () => {
    const store = new TokenBucketStore({ capacity: 5, refillWindowMs: 60_000, now: () => 0 });
    for (let i = 0; i < 5; i++) {
      const d = store.take("ip");
      expect(d.allowed).toBe(true);
      expect(d.limit).toBe(5);
    }
    const denied = store.take("ip");
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("reports decreasing remaining tokens", () => {
    const store = new TokenBucketStore({ capacity: 3, refillWindowMs: 60_000, now: () => 0 });
    expect(store.take("ip").remaining).toBe(2);
    expect(store.take("ip").remaining).toBe(1);
    expect(store.take("ip").remaining).toBe(0);
  });

  it("keys buckets independently per client", () => {
    const store = new TokenBucketStore({ capacity: 1, refillWindowMs: 60_000, now: () => 0 });
    expect(store.take("a").allowed).toBe(true);
    expect(store.take("a").allowed).toBe(false);
    // A different key has its own full bucket.
    expect(store.take("b").allowed).toBe(true);
  });

  it("refills over time and permits again once a whole token accrues", () => {
    let clock = 0;
    const store = new TokenBucketStore({ capacity: 5, refillWindowMs: 60_000, now: () => clock });
    for (let i = 0; i < 5; i++) store.take("ip");
    expect(store.take("ip").allowed).toBe(false);
    // 5 tokens / 60s => one token every 12s. Advance 12s.
    clock = 12_000;
    expect(store.take("ip").allowed).toBe(true);
    // Immediately after, drained again.
    expect(store.take("ip").allowed).toBe(false);
  });

  it("never exceeds capacity no matter how long it sits idle", () => {
    let clock = 0;
    const store = new TokenBucketStore({ capacity: 5, refillWindowMs: 60_000, now: () => clock });
    store.take("ip"); // remaining 4
    clock = 10 * 60_000; // 10 minutes later
    const d = store.take("ip");
    // Full again minus the one just spent.
    expect(d.remaining).toBe(4);
  });

  it("rejects invalid options", () => {
    expect(() => new TokenBucketStore({ capacity: 0, refillWindowMs: 1000 })).toThrow();
    expect(() => new TokenBucketStore({ capacity: 5, refillWindowMs: 0 })).toThrow();
    expect(() => new TokenBucketStore({ capacity: 5, refillWindowMs: 1000, idleMs: 0 })).toThrow();
    expect(() => new TokenBucketStore({ capacity: 5, refillWindowMs: 1000, maxKeys: 0 })).toThrow();
  });

  it("evicts buckets idle longer than idleMs", () => {
    let clock = 0;
    const store = new TokenBucketStore({
      capacity: 5,
      refillWindowMs: 60_000,
      idleMs: 1_000,
      now: () => clock,
    });
    store.take("a");
    store.take("b");
    expect(store.size()).toBe(2);
    // Advance past the idle window, then touch a different key: the two stale
    // buckets are swept, leaving only the freshly touched one.
    clock = 5_000;
    store.take("c");
    expect(store.size()).toBe(1);
  });

  it("caps the map size with LRU eviction of the oldest keys", () => {
    let clock = 0;
    const store = new TokenBucketStore({
      capacity: 5,
      refillWindowMs: 60_000,
      maxKeys: 2,
      now: () => clock,
    });
    store.take("a");
    clock = 1;
    store.take("b");
    clock = 2;
    store.take("c"); // exceeds cap → "a" (least recently used) evicted
    expect(store.size()).toBe(2);
    // "a" was evicted, so its bucket is fresh again (full capacity minus this take).
    expect(store.take("a").remaining).toBe(4);
  });
});

/**
 * Store selection is env/config-driven and must default to in-memory so dev and
 * tests never need a database (Track F).
 */
describe("resolveRateLimitStoreKind", () => {
  const saved = process.env.RATE_LIMIT_STORE;
  afterEach(() => {
    if (saved === undefined) delete process.env.RATE_LIMIT_STORE;
    else process.env.RATE_LIMIT_STORE = saved;
  });

  it("defaults to memory when the env var is unset", () => {
    delete process.env.RATE_LIMIT_STORE;
    expect(resolveRateLimitStoreKind()).toBe("memory");
  });

  it("selects postgres only for RATE_LIMIT_STORE=postgres (case-insensitive)", () => {
    process.env.RATE_LIMIT_STORE = "Postgres";
    expect(resolveRateLimitStoreKind()).toBe("postgres");
  });

  it("treats any other value as memory", () => {
    process.env.RATE_LIMIT_STORE = "redis";
    expect(resolveRateLimitStoreKind()).toBe("memory");
  });

  it("honors an explicit override regardless of env", () => {
    process.env.RATE_LIMIT_STORE = "postgres";
    expect(resolveRateLimitStoreKind("memory")).toBe("memory");
    delete process.env.RATE_LIMIT_STORE;
    expect(resolveRateLimitStoreKind("postgres")).toBe("postgres");
  });
});

/** Constructor validation is pure (no DB), so it is a unit concern. */
describe("PostgresFixedWindowStore options", () => {
  it("rejects invalid options", () => {
    expect(() => new PostgresFixedWindowStore({ capacity: 0, windowMs: 1000, scope: "x" })).toThrow();
    expect(() => new PostgresFixedWindowStore({ capacity: 5, windowMs: 0, scope: "x" })).toThrow();
    expect(
      () =>
        new PostgresFixedWindowStore({
          capacity: 5,
          windowMs: 1000,
          scope: "x",
          cleanupProbability: 2,
        }),
    ).toThrow();
  });
});
