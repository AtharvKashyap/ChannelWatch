import type { MiddlewareHandler } from "hono";
import { RATE_LIMIT_OUTCOME_KEY } from "./rate-limit.js";
import {
  METRIC_CORRECTIONS_SUBMITTED,
  METRIC_REQUESTS_RATE_LIMITED,
  METRIC_REQUESTS_TOTAL,
  metricsEnabled,
  recordMetricSafe,
} from "./metrics.js";

/**
 * Structured request logging (Track F; launch checklist §7.2). One JSON line per
 * request: method, route TEMPLATE (never the concrete path, so no channel/entity
 * ids leak into logs), status, duration, and the rate-limit outcome.
 *
 * PRIVACY (`PRIVACY.md`): the log deliberately carries NO IP address and NO
 * viewer/user identifier. Rate limiting keys on the client IP internally, but
 * that value is never written to a log line — only the allowed/limited outcome
 * is. The one caller-derived field is the route template, which is a fixed set
 * of patterns, not per-viewer data.
 *
 * The same middleware optionally records the coarse abuse-monitoring metrics
 * (§5.4) when `ABUSE_METRICS=on`; that path is best-effort and independent of
 * whether logging itself is enabled.
 */

export interface RequestLogEntry {
  method: string;
  /** The matched route template (e.g. `/api/v1/channels/youtube/:youtubeChannelId`). */
  path: string;
  status: number;
  duration_ms: number;
  /** Rate-limit decision for this request, or "none" on unlimited routes. */
  rate_limit: "allowed" | "limited" | "none";
}

/** Serialize a log entry as a single JSON line (no trailing newline). */
export function formatLogEntry(entry: RequestLogEntry): string {
  return JSON.stringify({ type: "request", ...entry });
}

/**
 * Whether request logging is enabled. Default ON, but QUIET in tests
 * (`NODE_ENV=test`). `REQUEST_LOG=off` forces it off (even in prod);
 * `REQUEST_LOG=on` forces it on (even in tests).
 */
export function requestLoggingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = env.REQUEST_LOG?.trim().toLowerCase();
  if (flag === "off") return false;
  if (flag === "on") return true;
  return env.NODE_ENV !== "test";
}

export interface RequestLoggerOptions {
  /**
   * Where a formatted line goes. Defaults to `console.log`. Tests inject a
   * collector; a deploy could point it at a file/stream.
   */
  sink?: (line: string) => void;
  /** Override the enabled decision (tests). Defaults to `requestLoggingEnabled()`. */
  enabled?: boolean;
  /** Override the metrics-enabled decision (tests). Defaults to `metricsEnabled()`. */
  recordMetrics?: boolean;
  /** Injectable clock (ms). Defaults to `Date.now`. */
  now?: () => number;
}

/**
 * Build the request-logging (+ optional metrics) middleware. Mount it OUTERMOST
 * so it measures the full request duration and observes the final status.
 */
export function requestLogger(options: RequestLoggerOptions = {}): MiddlewareHandler {
  const sink = options.sink ?? ((line: string) => console.log(line));
  const enabled = options.enabled ?? requestLoggingEnabled();
  const doRecordMetrics = options.recordMetrics ?? metricsEnabled();
  const clock = options.now ?? Date.now;

  return async (c, next) => {
    const start = clock();
    await next();
    const durationMs = Math.max(0, Math.round(clock() - start));

    const outcome = c.get(RATE_LIMIT_OUTCOME_KEY);
    const rateLimit: RequestLogEntry["rate_limit"] = outcome ?? "none";
    // The full matched template; "/*" for unmatched (404) routes.
    const path = c.req.routePath;
    const status = c.res.status;

    if (enabled) {
      sink(
        formatLogEntry({
          method: c.req.method,
          path,
          status,
          duration_ms: durationMs,
          rate_limit: rateLimit,
        }),
      );
    }

    if (doRecordMetrics) {
      recordMetricSafe(METRIC_REQUESTS_TOTAL, { now: start });
      if (rateLimit === "limited") {
        recordMetricSafe(METRIC_REQUESTS_RATE_LIMITED, { now: start });
      }
      // A successfully accepted public correction (§23.3). Keyed off the route
      // template + created status so it counts real submissions only.
      if (
        c.req.method === "POST" &&
        path === "/api/v1/corrections" &&
        status >= 200 &&
        status < 300
      ) {
        recordMetricSafe(METRIC_CORRECTIONS_SUBMITTED, { now: start });
      }
    }
  };
}
