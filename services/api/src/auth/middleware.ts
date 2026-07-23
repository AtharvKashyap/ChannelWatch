import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { getDb } from "../db/client.js";
import { unauthorized } from "../http/middleware.js";
import { SESSION_COOKIE, SESSION_TTL_MS, resolveSession, type ReviewerRow } from "./sessions.js";

/**
 * Reviewer authentication middleware for the authed `/review` API surface. Reads
 * the opaque session token from the HttpOnly `cw_session` cookie, resolves it to
 * a reviewer, and stashes the reviewer on the context for downstream handlers.
 * A missing/invalid/expired session is a clean 401 (never a 500). There is no
 * public signup — reviewer rows are provisioned by the seed script.
 */

/** Context key under which the authenticated reviewer is stored. */
export const REVIEWER_CTX_KEY = "reviewer";

/** Read the reviewer set by `requireReviewer` (throws if the guard did not run). */
export function currentReviewer(c: Context): ReviewerRow {
  const reviewer = c.get(REVIEWER_CTX_KEY) as ReviewerRow | undefined;
  if (!reviewer) throw unauthorized();
  return reviewer;
}

/** Hono middleware guarding a reviewer-only route group. */
export function requireReviewer(): MiddlewareHandler {
  return async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    const reviewer = await resolveSession(getDb(), token);
    if (!reviewer) {
      // Clear any stale cookie so the browser stops presenting it.
      deleteCookie(c, SESSION_COOKIE, { path: "/" });
      throw unauthorized();
    }
    c.set(REVIEWER_CTX_KEY, reviewer);
    await next();
  };
}

/** Whether cookies should carry the Secure attribute (all non-dev environments). */
function useSecureCookie(): boolean {
  return process.env.NODE_ENV === "production" || process.env.SECURE_COOKIES === "1";
}

/** Set the session cookie: HttpOnly, SameSite=Lax, Path=/, Secure off dev only. */
export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    secure: useSecureCookie(),
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

/** Clear the session cookie (logout). */
export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}
