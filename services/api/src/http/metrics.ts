import type postgres from "postgres";
import { getSql } from "../db/client.js";

/**
 * Coarse request-metrics recording + reading (Track F abuse-monitoring stopgap;
 * launch checklist §5.4/§7.2). Backed by the `request_metrics` table: one
 * counter row per (metric, fixed window), incremented with a single atomic
 * upsert. This is a launch-gap tally so a reviewer can see request volume, how
 * much traffic is rate-limited, and correction-submission volume — NOT
 * observability infrastructure.
 *
 * PRIVACY: only aggregate counts are stored — no IP addresses, paths, or viewer
 * identifiers (`PRIVACY.md`). Recording is env-gated (`ABUSE_METRICS=on`, off by
 * default) and always best-effort so it can never break or slow a failed
 * request into an error.
 */

type Sql = ReturnType<typeof postgres>;

/** Metric names. Kept small and stable — the reviewer endpoint keys on these. */
export const METRIC_REQUESTS_TOTAL = "requests_total";
export const METRIC_REQUESTS_RATE_LIMITED = "requests_rate_limited";
export const METRIC_CORRECTIONS_SUBMITTED = "corrections_submitted";

/** Default metric window: one hour. */
export const DEFAULT_METRIC_WINDOW_MS = 60 * 60 * 1000;

/**
 * Whether request-metrics recording is enabled. OFF unless `ABUSE_METRICS=on`,
 * so dev, tests, and any deploy that has not opted in incur no per-request DB
 * write. The read endpoint works regardless (it just reports whatever is there).
 */
export function metricsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ABUSE_METRICS?.trim().toLowerCase() === "on";
}

/** Epoch-ms start of the fixed metric window containing `now`. */
export function metricWindowStart(now: number, windowMs = DEFAULT_METRIC_WINDOW_MS): number {
  return Math.floor(now / windowMs) * windowMs;
}

export interface RecordMetricOptions {
  /** Injectable postgres-js client (tests). Defaults to the shared `getSql()`. */
  sql?: Sql;
  /** Injectable clock (ms). Defaults to `Date.now`. */
  now?: number;
  windowMs?: number;
  /** Increment amount (default 1). */
  amount?: number;
}

/** Atomically increment a metric counter for its current fixed window. */
export async function recordMetric(
  metric: string,
  options: RecordMetricOptions = {},
): Promise<void> {
  const sql = options.sql ?? getSql();
  const windowMs = options.windowMs ?? DEFAULT_METRIC_WINDOW_MS;
  const now = options.now ?? Date.now();
  const windowStart = metricWindowStart(now, windowMs);
  const amount = options.amount ?? 1;
  await sql`
    insert into request_metrics (metric, window_start, count, updated_at)
    values (${metric}, ${windowStart}, ${amount}, now())
    on conflict (metric, window_start)
    do update set count = request_metrics.count + ${amount}, updated_at = now()
  `;
}

/**
 * Fire-and-forget recorder: swallows every error (a metrics write must never
 * break a request). Use on the hot path; use `recordMetric` when a caller wants
 * to await/observe failures (tests).
 */
export function recordMetricSafe(metric: string, options: RecordMetricOptions = {}): void {
  void recordMetric(metric, options).catch(() => {});
}

export interface MetricsWindow {
  window_start: number;
  window_start_iso: string;
  metrics: Record<string, number>;
}

export interface MetricsSnapshot {
  window_ms: number;
  generated_at: string;
  /** Summed across the returned windows, per metric. */
  totals: Record<string, number>;
  /** Newest-first, at most `limitWindows` entries. */
  windows: MetricsWindow[];
}

export interface ReadMetricsOptions {
  sql?: Sql;
  now?: number;
  windowMs?: number;
  /** How many recent windows to return (default 24). */
  limitWindows?: number;
}

/**
 * Read a per-window snapshot of the metric counters, newest window first, for
 * the guarded reviewer endpoint. Aggregates the returned windows into `totals`.
 */
export async function readMetrics(options: ReadMetricsOptions = {}): Promise<MetricsSnapshot> {
  const sql = options.sql ?? getSql();
  const windowMs = options.windowMs ?? DEFAULT_METRIC_WINDOW_MS;
  const now = options.now ?? Date.now();
  const limitWindows = options.limitWindows ?? 24;
  const currentWindow = metricWindowStart(now, windowMs);
  const earliest = currentWindow - (limitWindows - 1) * windowMs;

  const rows = await sql<{ metric: string; window_start: number | string; count: number | string }[]>`
    select metric, window_start, count
    from request_metrics
    where window_start >= ${earliest}
    order by window_start desc
  `;

  const byWindow = new Map<number, Record<string, number>>();
  const totals: Record<string, number> = {};
  for (const r of rows) {
    const ws = Number(r.window_start);
    const count = Number(r.count);
    const bucket = byWindow.get(ws) ?? {};
    bucket[r.metric] = (bucket[r.metric] ?? 0) + count;
    byWindow.set(ws, bucket);
    totals[r.metric] = (totals[r.metric] ?? 0) + count;
  }

  const windows: MetricsWindow[] = [...byWindow.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([window_start, metrics]) => ({
      window_start,
      window_start_iso: new Date(window_start).toISOString(),
      metrics,
    }));

  return {
    window_ms: windowMs,
    generated_at: new Date(now).toISOString(),
    totals,
    windows,
  };
}
