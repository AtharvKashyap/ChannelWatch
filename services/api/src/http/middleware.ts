import type { Context, MiddlewareHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * Cross-cutting HTTP middleware for the public API (SPEC §17): a uniform JSON
 * error envelope, security headers, and a CORS policy that admits the browser
 * extension and the configured web origin only. Kept framework-thin and pure of
 * business logic.
 */

/**
 * A domain error that carries an HTTP status and a stable machine code. Route
 * and query code throw this; `onError` renders it as the standard envelope. Any
 * non-`ApiError` throwable is treated as an opaque 500 (its message is not
 * leaked to the client).
 */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const notFound = (message = "Resource not found"): ApiError =>
  new ApiError(404, "NOT_FOUND", message);
export const badRequest = (message: string, code = "BAD_REQUEST"): ApiError =>
  new ApiError(400, code, message);
export const unauthorized = (message = "Authentication required."): ApiError =>
  new ApiError(401, "UNAUTHORIZED", message);
export const conflict = (message: string, code = "CONFLICT"): ApiError =>
  new ApiError(409, code, message);

export interface ErrorEnvelope {
  error: { code: string; message: string; details?: unknown };
}

/** Build the canonical error-envelope body. */
export function errorEnvelope(code: string, message: string, details?: unknown): ErrorEnvelope {
  return details === undefined
    ? { error: { code, message } }
    : { error: { code, message, details } };
}

/**
 * Resolve the client IP for rate limiting.
 *
 * SECURITY: `X-Forwarded-For` is client-controllable, so trusting it blindly
 * lets an attacker spoof a fresh IP per request and bypass the limiter. We
 * therefore trust forwarding headers ONLY when `TRUSTED_PROXY` is set in the
 * environment (the operator confirming the API sits behind a proxy that
 * rewrites XFF). Otherwise we key on the direct socket/connection address from
 * the Node server, falling back to a single `"unknown"` bucket when no address
 * is available (e.g. in-process test requests) — the limiter still functions,
 * it just cannot distinguish those callers.
 */
export function clientIp(c: Context): string {
  if (process.env.TRUSTED_PROXY) {
    const forwarded = c.req.header("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first) return first;
    }
    const real = c.req.header("x-real-ip")?.trim();
    if (real) return real;
  }
  // Direct connection address from @hono/node-server (undefined under
  // `app.request` in tests, where there is no socket).
  const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
  return env?.incoming?.socket?.remoteAddress || "unknown";
}

/** Origins the API allows via CORS: the browser extension(s) + configured web origin. */
function isAllowedOrigin(origin: string, webOrigin: string): boolean {
  if (origin === webOrigin) return true;
  // MV3 extension pages present a chrome-extension:// (or moz-extension://)
  // origin. The extension id is per-install, so we admit the scheme rather than
  // pin an id; the API is public-read + rate-limited, so this is not a secret
  // boundary (SPEC §31/§32: extension sends only channel id + version).
  return /^chrome-extension:\/\/[a-p]{32}$/.test(origin) || /^moz-extension:\/\//.test(origin);
}

/**
 * CORS middleware. Reflects an allowed Origin (never a blanket `*`, so that
 * credentialed and origin-scoped behavior is explicit), answers preflight
 * OPTIONS, and always sends `Vary: Origin` so caches key on it.
 */
export function cors(webOrigin: string): MiddlewareHandler {
  return async (c, next) => {
    const origin = c.req.header("Origin");
    c.header("Vary", "Origin");
    if (origin && isAllowedOrigin(origin, webOrigin)) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
      c.header("Access-Control-Allow-Headers", "Content-Type");
      // Credentialed requests: the authed `/review` console sends the session
      // cookie (fetch `credentials: "include"`). This requires a specific
      // reflected origin (never `*`, enforced above) plus this header.
      c.header("Access-Control-Allow-Credentials", "true");
      c.header("Access-Control-Max-Age", "600");
    }
    if (c.req.method === "OPTIONS") {
      return c.body(null, 204);
    }
    await next();
  };
}

/**
 * Baseline security headers appropriate for a JSON API: block content-type
 * sniffing, deny framing, and send a conservative referrer policy. No CSP here —
 * this API serves JSON, not HTML.
 */
export function securityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Cross-Origin-Resource-Policy", "cross-origin");
  };
}
