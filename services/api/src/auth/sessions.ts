import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { reviewers, sessions } from "../db/schema.js";

/**
 * Opaque server-side reviewer sessions (M3 auth). Login mints a high-entropy
 * random token; the RAW token is what goes in the client's HttpOnly cookie, and
 * only its SHA-256 hash is stored in `sessions.token_hash`. A DB leak therefore
 * cannot be replayed as a live cookie. Sessions expire after `SESSION_TTL_MS`;
 * logout deletes the row.
 */

/** Cookie name carrying the opaque session token. */
export const SESSION_COOKIE = "cw_session";

/** Session lifetime: 7 days. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Bytes of entropy in a session token (256-bit). */
const TOKEN_BYTES = 32;

export type ReviewerRow = typeof reviewers.$inferSelect;

/** Deterministically hash a token for storage/lookup (never store the raw token). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Create a session for a reviewer, returning the RAW token (to be set as the
 * cookie) and the row's expiry. Only the token hash is persisted.
 */
export async function createSession(
  db: Database,
  reviewerId: string,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(sessions).values({ tokenHash: hashToken(token), reviewerId, expiresAt });
  return { token, expiresAt };
}

/**
 * Resolve a raw session token to its reviewer, or null when the token is absent,
 * unknown, or expired. Expired sessions are treated as no session.
 */
export async function resolveSession(
  db: Database,
  token: string | undefined | null,
  now: Date = new Date(),
): Promise<ReviewerRow | null> {
  if (!token) return null;
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, now)));
  if (!session) return null;
  const [reviewer] = await db.select().from(reviewers).where(eq(reviewers.id, session.reviewerId));
  return reviewer ?? null;
}

/** Delete the session identified by a raw token (logout). Safe if not present. */
export async function deleteSession(db: Database, token: string | undefined | null): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/** Housekeeping: remove all expired sessions. */
export async function purgeExpiredSessions(db: Database, now: Date = new Date()): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
}
