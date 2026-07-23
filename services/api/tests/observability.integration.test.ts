import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/index.js";
import { getSql, closeDb, getDb } from "../src/db/client.js";
import { PostgresFixedWindowStore } from "../src/http/rate-limit.js";
import {
  METRIC_CORRECTIONS_SUBMITTED,
  METRIC_REQUESTS_RATE_LIMITED,
  METRIC_REQUESTS_TOTAL,
  readMetrics,
  recordMetric,
} from "../src/http/metrics.js";
import { seedReviewer } from "../scripts/seed-reviewer.js";

/**
 * DB-gated integration tests for Track F durable rate limiting + abuse metrics.
 * Runs ONLY against a reachable Postgres; skips cleanly otherwise. All fixtures
 * are scoped to test-only `scope`/`metric` prefixes and cleaned up so re-runs
 * (and coexistence with the other DB-gated suites) stay deterministic.
 */

const DATABASE_URL = process.env.DATABASE_URL;

// Test-only namespaces so we never touch real limiter/metric rows.
const SCOPE = "test-scope-trackf";
const M_TOTAL = "test_trackf_requests_total";
const M_LIMITED = "test_trackf_requests_rate_limited";

async function probe(): Promise<boolean> {
  if (!DATABASE_URL) return false;
  const sql = postgres(DATABASE_URL, { max: 1, connect_timeout: 3, onnotice: () => {} });
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

const reachable = await probe();
if (!reachable) {
  console.warn(
    "[observability] SKIPPED: DATABASE_URL is unset or unreachable. " +
      "Run a Postgres and set DATABASE_URL to enable these tests.",
  );
}

describe.skipIf(!reachable)("Track F durable rate limiting + metrics", () => {
  beforeAll(async () => {
    const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
    const sql = postgres(DATABASE_URL!, { max: 1, onnotice: () => {} });
    try {
      await migrate(drizzle(sql), { migrationsFolder });
    } finally {
      await sql.end({ timeout: 5 });
    }
    // Clean any residue from prior runs.
    const s = getSql();
    await s`delete from rate_limit_counters where scope = ${SCOPE}`;
    await s`delete from request_metrics where metric in (${M_TOTAL}, ${M_LIMITED})`;
  });

  afterAll(async () => {
    const s = getSql();
    await s`delete from rate_limit_counters where scope = ${SCOPE}`;
    await s`delete from request_metrics where metric in (${M_TOTAL}, ${M_LIMITED})`;
    await closeDb();
  });

  it("PostgresFixedWindowStore admits up to capacity, then denies (fixed window)", async () => {
    const store = new PostgresFixedWindowStore({
      capacity: 3,
      windowMs: 60_000,
      scope: SCOPE,
      now: () => 0, // pin the window
      cleanupProbability: 0, // deterministic
    });

    const key = "1.2.3.4";
    const d1 = await store.take(key);
    expect(d1.allowed).toBe(true);
    expect(d1.limit).toBe(3);
    expect(d1.remaining).toBe(2);
    expect((await store.take(key)).remaining).toBe(1);
    expect((await store.take(key)).remaining).toBe(0);

    const denied = await store.take(key);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keys independently per client and shares state across store instances", async () => {
    const opts = {
      capacity: 1,
      windowMs: 60_000,
      scope: SCOPE,
      now: () => 60_000,
      cleanupProbability: 0,
    };
    const storeA = new PostgresFixedWindowStore(opts);
    // A different key has its own budget.
    expect((await storeA.take("clientX")).allowed).toBe(true);
    expect((await storeA.take("clientX")).allowed).toBe(false);
    expect((await storeA.take("clientY")).allowed).toBe(true);

    // A SEPARATE instance (simulating another process) sees the SAME durable
    // counter — the whole point of the Postgres store.
    const storeB = new PostgresFixedWindowStore(opts);
    expect((await storeB.take("clientX")).allowed).toBe(false);
  });

  it("resets in the next fixed window", async () => {
    const base = 120_000;
    const w1 = new PostgresFixedWindowStore({
      capacity: 1,
      windowMs: 60_000,
      scope: SCOPE,
      now: () => base,
      cleanupProbability: 0,
    });
    expect((await w1.take("roller")).allowed).toBe(true);
    expect((await w1.take("roller")).allowed).toBe(false);

    // Advance into the next window: the counter is a fresh row → allowed again.
    const w2 = new PostgresFixedWindowStore({
      capacity: 1,
      windowMs: 60_000,
      scope: SCOPE,
      now: () => base + 60_000,
      cleanupProbability: 0,
    });
    expect((await w2.take("roller")).allowed).toBe(true);
  });

  it("sweepExpired removes windows past their expiry", async () => {
    const store = new PostgresFixedWindowStore({
      capacity: 5,
      windowMs: 60_000,
      scope: SCOPE,
      now: () => 0,
      cleanupProbability: 0,
    });
    await store.take("sweep-me"); // creates a window expiring at 60_000
    // Sweep as-of a time well past expiry.
    const removed = await store.sweepExpired(10 * 60_000);
    expect(removed).toBeGreaterThanOrEqual(1);
  });

  it("recordMetric increments and readMetrics aggregates per window", async () => {
    const now = 5 * 60 * 60 * 1000; // an arbitrary hour boundary
    await recordMetric(M_TOTAL, { now });
    await recordMetric(M_TOTAL, { now });
    await recordMetric(M_LIMITED, { now });

    const snap = await readMetrics({ now, limitWindows: 2 });
    expect(snap.totals[M_TOTAL]).toBe(2);
    expect(snap.totals[M_LIMITED]).toBe(1);
    expect(snap.windows.length).toBeGreaterThanOrEqual(1);
    expect(snap.windows[0]!.metrics[M_TOTAL]).toBe(2);
  });

  it("guards the reviewer /metrics endpoint (401 unauthenticated, 200 authed)", async () => {
    // Unauthenticated is rejected.
    const anon = await createApp().request("/api/v1/reviewer/metrics");
    expect(anon.status).toBe(401);

    // Seed a reviewer + log in.
    const password = "trackf-metrics-secret-123";
    await seedReviewer(getDb(), {
      email: "trackf-metrics@test.local",
      password,
      displayName: "Track F",
    });
    const login = await createApp().request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "trackf-metrics@test.local", password }),
    });
    expect(login.status).toBe(200);
    const setCookie = login.headers.get("set-cookie") ?? "";
    const token = /cw_session=([^;]+)/.exec(setCookie)?.[1];
    expect(token).toBeTruthy();

    const res = await createApp().request("/api/v1/reviewer/metrics", {
      headers: { Cookie: `cw_session=${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      window_ms: number;
      totals: Record<string, number>;
      windows: unknown[];
    };
    expect(typeof body.window_ms).toBe("number");
    expect(body).toHaveProperty("totals");
    expect(Array.isArray(body.windows)).toBe(true);

    // Rejects an out-of-range window count.
    const bad = await createApp().request("/api/v1/reviewer/metrics?windows=0", {
      headers: { Cookie: `cw_session=${token}` },
    });
    expect(bad.status).toBe(400);
  });

  it("known metric names are stable", () => {
    expect(METRIC_REQUESTS_TOTAL).toBe("requests_total");
    expect(METRIC_REQUESTS_RATE_LIMITED).toBe("requests_rate_limited");
    expect(METRIC_CORRECTIONS_SUBMITTED).toBe("corrections_submitted");
  });
});
