import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import {
  formatLogEntry,
  requestLogger,
  requestLoggingEnabled,
} from "../src/http/request-log.js";
import { RATE_LIMIT_OUTCOME_KEY } from "../src/http/rate-limit.js";
import { metricWindowStart, metricsEnabled } from "../src/http/metrics.js";

/**
 * Pure/HTTP unit tests for the observability middleware (Track F) — NO DB. The
 * DB-backed metric recording + reading is covered by the DB-gated
 * `observability.integration.test.ts`.
 */

describe("requestLoggingEnabled", () => {
  it("is off in tests by default (quiet)", () => {
    expect(requestLoggingEnabled({ NODE_ENV: "test" } as NodeJS.ProcessEnv)).toBe(false);
  });

  it("is on outside tests by default", () => {
    expect(requestLoggingEnabled({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(true);
    expect(requestLoggingEnabled({} as NodeJS.ProcessEnv)).toBe(true);
  });

  it("REQUEST_LOG=off forces off, REQUEST_LOG=on forces on", () => {
    expect(
      requestLoggingEnabled({ NODE_ENV: "production", REQUEST_LOG: "off" } as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(
      requestLoggingEnabled({ NODE_ENV: "test", REQUEST_LOG: "on" } as NodeJS.ProcessEnv),
    ).toBe(true);
  });
});

describe("metricsEnabled", () => {
  it("is off unless ABUSE_METRICS=on", () => {
    expect(metricsEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(metricsEnabled({ ABUSE_METRICS: "off" } as NodeJS.ProcessEnv)).toBe(false);
    expect(metricsEnabled({ ABUSE_METRICS: "ON" } as NodeJS.ProcessEnv)).toBe(true);
  });
});

describe("metricWindowStart", () => {
  it("floors to the window boundary", () => {
    const hour = 60 * 60 * 1000;
    expect(metricWindowStart(hour + 123, hour)).toBe(hour);
    expect(metricWindowStart(2 * hour, hour)).toBe(2 * hour);
  });
});

describe("formatLogEntry", () => {
  it("emits a single JSON line with the request fields and no identity fields", () => {
    const line = formatLogEntry({
      method: "GET",
      path: "/api/v1/channels/youtube/:youtubeChannelId",
      status: 200,
      duration_ms: 4,
      rate_limit: "allowed",
    });
    expect(line).not.toContain("\n");
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({
      type: "request",
      method: "GET",
      path: "/api/v1/channels/youtube/:youtubeChannelId",
      status: 200,
      rate_limit: "allowed",
    });
    // Privacy: no IP / identity keys ever appear.
    expect(Object.keys(parsed)).not.toContain("ip");
    expect(line.toLowerCase()).not.toContain("x-forwarded");
  });
});

describe("requestLogger middleware", () => {
  it("logs the route TEMPLATE (not the concrete id) with status + duration", async () => {
    const lines: string[] = [];
    const app = new Hono();
    let clock = 1000;
    app.use(
      "*",
      requestLogger({
        enabled: true,
        recordMetrics: false,
        sink: (l) => lines.push(l),
        now: () => (clock += 5),
      }),
    );
    app.get("/things/:id", (c) => c.json({ ok: true }));

    const res = await app.request("/things/UC12345678901234567890AB");
    expect(res.status).toBe(200);
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.path).toBe("/things/:id");
    expect(parsed.path).not.toContain("UC12345678901234567890AB");
    expect(parsed.method).toBe("GET");
    expect(parsed.status).toBe(200);
    expect(parsed.duration_ms).toBeGreaterThanOrEqual(0);
    expect(parsed.rate_limit).toBe("none");
  });

  it("reflects a rate-limit outcome recorded upstream on the context", async () => {
    const lines: string[] = [];
    const app = new Hono();
    app.use("*", requestLogger({ enabled: true, recordMetrics: false, sink: (l) => lines.push(l) }));
    app.use("*", async (c, next) => {
      c.set(RATE_LIMIT_OUTCOME_KEY, "limited");
      await next();
    });
    app.get("/limited", (c) => c.json({ ok: true }));

    await app.request("/limited");
    expect(JSON.parse(lines[0]!).rate_limit).toBe("limited");
  });

  it("does not log when disabled", async () => {
    const lines: string[] = [];
    const app = new Hono();
    app.use(
      "*",
      requestLogger({ enabled: false, recordMetrics: false, sink: (l) => lines.push(l) }),
    );
    app.get("/quiet", (c) => c.json({ ok: true }));
    await app.request("/quiet");
    expect(lines).toHaveLength(0);
  });
});
