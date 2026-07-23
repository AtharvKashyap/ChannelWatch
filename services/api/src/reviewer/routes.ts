import { Hono } from "hono";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getCookie } from "hono/cookie";
import {
  EntityCreateRequest,
  EntityUpdateRequest,
  LoginRequest,
  ReviewDecisionRequest,
  CorrectionResolutionRequest,
  type ReviewerProfile,
} from "@channelwatch/schemas";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { auditEvents, reviewers } from "../db/schema.js";
import { badRequest, errorEnvelope, notFound, unauthorized } from "../http/middleware.js";
import { createRateLimit } from "../http/rate-limit.js";
import { readMetrics } from "../http/metrics.js";
import { verifyPassword } from "../auth/passwords.js";
import {
  SESSION_COOKIE,
  createSession,
  deleteSession,
  type ReviewerRow,
} from "../auth/sessions.js";
import {
  clearSessionCookie,
  currentReviewer,
  requireReviewer,
  setSessionCookie,
} from "../auth/middleware.js";
import {
  approveClaim,
  createEntity,
  getEntityRecord,
  listAudit,
  listClaims,
  listCorrections,
  listEntities,
  parsePagination,
  rejectClaim,
  resolveCorrection,
  updateEntity,
} from "./service.js";

/** Maximum accepted authed POST body size (matches the public surface, §32.1). */
const MAX_POST_BODY_BYTES = 32 * 1024;

const Uuid = z.uuid();

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw badRequest("Request body must be valid JSON.", "INVALID_JSON");
  }
}

function profileOf(row: ReviewerRow): ReviewerProfile {
  return {
    id: row.id,
    email: row.email,
    display_name: row.displayName,
    role: row.role,
  };
}

/**
 * Reviewer authentication router (`/api/v1/auth`). No public signup — reviewer
 * rows are provisioned by the seed script. Login verifies the password against
 * the stored scrypt verifier, mints an opaque server-side session, and sets it
 * in an HttpOnly SameSite=Lax cookie. A dedicated slow limiter blunts brute
 * force. Login/logout are audited (security events).
 */
export function createAuthRouter(): Hono {
  const auth = new Hono();

  const postBodyLimit = bodyLimit({
    maxSize: MAX_POST_BODY_BYTES,
    onError: (c) =>
      c.json(errorEnvelope("PAYLOAD_TOO_LARGE", "Request body exceeds the 32KB limit."), 413),
  });
  // Slow the login path to blunt credential-stuffing: 10 attempts/min/IP.
  const loginLimit = createRateLimit({ capacity: 10, refillWindowMs: 60_000, scope: "login" });
  auth.use("/login", loginLimit, postBodyLimit);

  auth.post("/login", async (c) => {
    const body = LoginRequest.parse(await readJson(c));
    const db = getDb();
    const [reviewer] = await db.select().from(reviewers).where(eq(reviewers.email, body.email));
    // Verify even when the reviewer is unknown / has no credential, to avoid a
    // timing signal that reveals which emails exist.
    const ok = await verifyPassword(body.password, reviewer?.passwordHash ?? null);
    if (!reviewer || !ok) {
      throw unauthorized("Invalid email or password.");
    }
    const { token } = await createSession(db, reviewer.id);
    setSessionCookie(c, token);
    await db.insert(auditEvents).values({
      actorId: reviewer.id,
      action: "REVIEWER_LOGIN",
      objectType: "session",
      objectId: reviewer.id,
      beforeState: null,
      afterState: { email: reviewer.email },
    });
    return c.json({ reviewer: profileOf(reviewer) }, 200);
  });

  auth.post("/logout", async (c) => {
    const db = getDb();
    const token = getCookie(c, SESSION_COOKIE);
    // Resolve the reviewer (if any) for the audit trail, then drop the session.
    if (token) {
      await deleteSession(db, token);
    }
    clearSessionCookie(c);
    return c.json({ ok: true }, 200);
  });

  // Who am I — the console uses this to bootstrap the authed shell. Guarded.
  auth.get("/me", requireReviewer(), (c) => {
    return c.json({ reviewer: profileOf(currentReviewer(c)) }, 200);
  });

  return auth;
}

/**
 * Authed reviewer router (`/api/v1/reviewer`, SPEC §17 authed endpoints, §19.5,
 * §20). Every route is guarded by the session middleware, and every mutation
 * writes an `audit_events` row inside the service layer (CLAUDE.md rule 6). The
 * two-person publication rule (§20.3) is enforced in the service.
 */
export function createReviewerRouter(): Hono {
  const r = new Hono();

  const postBodyLimit = bodyLimit({
    maxSize: MAX_POST_BODY_BYTES,
    onError: (c) =>
      c.json(errorEnvelope("PAYLOAD_TOO_LARGE", "Request body exceeds the 32KB limit."), 413),
  });

  // Guard everything below.
  r.use("*", requireReviewer());

  const requireUuid = (raw: string, label: string): string => {
    const parsed = Uuid.safeParse(raw);
    if (!parsed.success) throw badRequest(`${label} must be a UUID.`, "INVALID_ID");
    return parsed.data;
  };

  // ---- Claim queue + review decisions (§20) ----
  r.get("/claims", async (c) => {
    const status = c.req.query("status")?.trim() || undefined;
    const claims = await listClaims(getDb(), status);
    return c.json({ count: claims.length, claims }, 200);
  });

  r.post("/claims/:id/approve", postBodyLimit, async (c) => {
    const id = requireUuid(c.req.param("id"), "Claim id");
    const body = ReviewDecisionRequest.parse(await readJson(c));
    const reviewer = currentReviewer(c);
    const { response } = await approveClaim(getDb(), reviewer.id, id, body.reasoning);
    return c.json(response, 200);
  });

  r.post("/claims/:id/reject", postBodyLimit, async (c) => {
    const id = requireUuid(c.req.param("id"), "Claim id");
    const body = ReviewDecisionRequest.parse(await readJson(c));
    const reviewer = currentReviewer(c);
    const { response } = await rejectClaim(getDb(), reviewer.id, id, body.reasoning);
    return c.json(response, 200);
  });

  // ---- Entity CRUD (§19.5) ----
  r.get("/entities", async (c) => {
    const entities = await listEntities(getDb());
    return c.json({ count: entities.length, entities }, 200);
  });

  r.get("/entities/:id", async (c) => {
    const id = requireUuid(c.req.param("id"), "Entity id");
    const entity = await getEntityRecord(getDb(), id);
    if (!entity) throw notFound("Entity not found.");
    return c.json(entity, 200);
  });

  r.post("/entities", postBodyLimit, async (c) => {
    const body = EntityCreateRequest.parse(await readJson(c));
    const reviewer = currentReviewer(c);
    const created = await createEntity(getDb(), reviewer.id, body);
    return c.json(created, 201);
  });

  r.patch("/entities/:id", postBodyLimit, async (c) => {
    const id = requireUuid(c.req.param("id"), "Entity id");
    const body = EntityUpdateRequest.parse(await readJson(c));
    const reviewer = currentReviewer(c);
    const updated = await updateEntity(getDb(), reviewer.id, id, body);
    return c.json(updated, 200);
  });

  // ---- Correction inbox (§23.3, §24) ----
  r.get("/corrections", async (c) => {
    const status = c.req.query("status")?.trim() || undefined;
    const corrections = await listCorrections(getDb(), status);
    return c.json({ count: corrections.length, corrections }, 200);
  });

  r.post("/corrections/:id/resolve", postBodyLimit, async (c) => {
    const id = requireUuid(c.req.param("id"), "Correction id");
    const body = CorrectionResolutionRequest.parse(await readJson(c));
    const reviewer = currentReviewer(c);
    const updated = await resolveCorrection(getDb(), reviewer.id, id, body.reasoning, "RESOLVED");
    return c.json(updated, 200);
  });

  r.post("/corrections/:id/dismiss", postBodyLimit, async (c) => {
    const id = requireUuid(c.req.param("id"), "Correction id");
    const body = CorrectionResolutionRequest.parse(await readJson(c));
    const reviewer = currentReviewer(c);
    const updated = await resolveCorrection(getDb(), reviewer.id, id, body.reasoning, "DISMISSED");
    return c.json(updated, 200);
  });

  // ---- Abuse-monitoring metrics (Track F; launch checklist §5.4/§7.2) ----
  // A reviewer-guarded, coarse stopgap: request totals, rate-limited counts, and
  // correction-submission volume, bucketed per fixed window. Aggregate counts
  // only — no IPs or viewer identifiers (PRIVACY.md). `?windows=N` bounds how
  // many recent windows are returned (1–168, default 24).
  r.get("/metrics", async (c) => {
    const raw = c.req.query("windows");
    let limitWindows = 24;
    if (raw !== undefined) {
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 168) {
        throw badRequest("`windows` must be an integer between 1 and 168.", "INVALID_WINDOWS");
      }
      limitWindows = parsed;
    }
    const snapshot = await readMetrics({ limitWindows });
    return c.json(snapshot, 200);
  });

  // ---- Audit viewer (§26.5) ----
  r.get("/audit", async (c) => {
    const subjectRaw = c.req.query("subjectId")?.trim();
    const subjectId = subjectRaw ? requireUuid(subjectRaw, "subjectId") : undefined;
    const { limit, offset } = parsePagination(c.req.query("limit"), c.req.query("offset"));
    const result = await listAudit(getDb(), { subjectId, limit, offset });
    return c.json(result, 200);
  });

  return r;
}
