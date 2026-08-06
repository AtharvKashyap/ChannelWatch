import { Hono } from "hono";
import { getSql } from "./db/client.js";
import { cors, errorEnvelope, securityHeaders } from "./http/middleware.js";
import { requestLogger } from "./http/request-log.js";
import { createV1Router, renderError } from "./routes.js";
import { createAuthRouter, createReviewerRouter } from "./reviewer/routes.js";

/**
 * CHANNELWATCH API (SPEC §17). `GET /healthz` plus the public `/api/v1`
 * read + intake endpoints, wrapped in cross-cutting middleware (CORS scoped to
 * the extension + web origin, security headers, a uniform JSON error envelope,
 * and per-IP rate limiting inside the v1 router). `createApp` is exported so
 * tests can exercise the app without binding a port.
 *
 * The configured web origin comes from `WEB_ORIGIN` (defaults to the local dev
 * origin); the browser extension's `chrome-extension://` / `moz-extension://`
 * origins are always admitted (see `http/middleware.ts`).
 */
export function createApp(): Hono {
  const app = new Hono();
  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

  // Outermost: structured JSON request logging (+ optional abuse metrics). It
  // measures the full request and sees the final status and rate-limit outcome.
  // Default on in prod, quiet in tests; env-toggled (see http/request-log.ts).
  app.use("*", requestLogger());
  app.use("*", securityHeaders());
  app.use("*", cors(webOrigin));

  // Uniform error handling for everything below.
  app.onError((err, c) => renderError(err, c));
  app.notFound((c) => c.json(errorEnvelope("NOT_FOUND", "Route not found."), 404));

  app.get("/healthz", async (c) => {
    try {
      await getSql()`select 1`;
      return c.json({ status: "ok", db: "up" });
    } catch (err) {
      // Log the raw DB error server-side only; NEVER return it to the client (a
      // health probe is unauthenticated, and the error string can leak the
      // connection host/driver internals).
      console.error("healthz db check failed:", err instanceof Error ? err.message : String(err));
      return c.json({ status: "degraded", db: "down" }, 503);
    }
  });

  app.route("/api/v1", createV1Router());
  // Authed reviewer surface (M3, SPEC §17 authed endpoints). Mounted as sibling
  // routers so the public router's rate limits (scoped to its own paths) do not
  // throttle authenticated reviewer mutations.
  app.route("/api/v1/auth", createAuthRouter());
  app.route("/api/v1/reviewer", createReviewerRouter());

  return app;
}

export const app = createApp();
export default app;

export * from "./db/schema.js";
export * from "./db/mappers.js";
export { getDb, getSql, closeDb } from "./db/client.js";
