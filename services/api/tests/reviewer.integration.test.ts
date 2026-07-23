import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/index.js";
import { getDb, closeDb } from "../src/db/client.js";
import {
  auditEvents,
  channels,
  claims,
  correctionRequests,
  entities,
  reviews,
  sessions,
} from "../src/db/schema.js";
import { seedReviewer } from "../scripts/seed-reviewer.js";

/**
 * DB-gated integration tests for the authed reviewer surface (§17 authed
 * endpoints, §19.5, §20). Runs ONLY against a reachable Postgres; skips cleanly
 * otherwise. Fixtures use fixed UUIDs so re-runs are idempotent (cleaned + re-
 * inserted in beforeAll). The prime assertion is the §20.3 two-person rule: a
 * PE-related claim needs TWO distinct reviewers before it publishes.
 */

const DATABASE_URL = process.env.DATABASE_URL;

// Fixed fixture ids (idempotent re-runs).
const CH_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const CO_ID = "aaaaaaaa-0000-4000-8000-000000000002";
const PE_ID = "aaaaaaaa-0000-4000-8000-000000000003";
const CLAIM_SENSITIVE = "aaaaaaaa-0000-4000-8000-000000000010";
const CLAIM_PLAIN = "aaaaaaaa-0000-4000-8000-000000000011";
const CORR_ID = "aaaaaaaa-0000-4000-8000-000000000020";
const YT_ID = "UCtrackbtest0000000000AA";

const PASSWORD = "trackb-secret-123456";

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
    "[reviewer] SKIPPED: DATABASE_URL is unset or unreachable. " +
      "Run `docker compose up -d postgres`, migrate, and set DATABASE_URL.",
  );
}

/** Extract the session token from a login response's Set-Cookie header. */
function tokenFromResponse(res: Response): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = /cw_session=([^;]+)/.exec(setCookie);
  if (!match) throw new Error(`no session cookie in response: ${setCookie}`);
  return match[1]!;
}

describe.skipIf(!reachable)("authed reviewer API (§17/§19.5/§20)", () => {
  let reviewerAId: string;
  let reviewerBId: string;

  beforeAll(async () => {
    const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
    const sql = postgres(DATABASE_URL!, { max: 1, onnotice: () => {} });
    try {
      await migrate(drizzle(sql), { migrationsFolder });
    } finally {
      await sql.end({ timeout: 5 });
    }

    const db = getDb();
    // ---- idempotent cleanup of prior fixtures ----
    await db.delete(reviews).where(inArray(reviews.claimId, [CLAIM_SENSITIVE, CLAIM_PLAIN]));
    await db.delete(claims).where(inArray(claims.id, [CLAIM_SENSITIVE, CLAIM_PLAIN]));
    await db.delete(correctionRequests).where(eq(correctionRequests.id, CORR_ID));
    await db.delete(entities).where(inArray(entities.id, [CO_ID, PE_ID]));
    await db.delete(channels).where(eq(channels.id, CH_ID));
    await db
      .delete(auditEvents)
      .where(
        inArray(auditEvents.objectId, [CH_ID, CO_ID, PE_ID, CLAIM_SENSITIVE, CLAIM_PLAIN, CORR_ID]),
      );

    // ---- reviewers (provisioned via the env-driven seed helper) ----
    const a = await seedReviewer(db, {
      email: "trackb-reviewer-a@test.local",
      password: PASSWORD,
      displayName: "Reviewer A",
    });
    const b = await seedReviewer(db, {
      email: "trackb-reviewer-b@test.local",
      password: PASSWORD,
      displayName: "Reviewer B",
    });
    reviewerAId = a.id;
    reviewerBId = b.id;

    // ---- fixture entities / channel / claims / correction ----
    await db.insert(entities).values([
      { id: CO_ID, entityType: "COMPANY", canonicalName: "TrackB Test Media" },
      { id: PE_ID, entityType: "PRIVATE_EQUITY_FIRM", canonicalName: "TrackB Test Capital" },
    ]);
    await db.insert(channels).values({
      id: CH_ID,
      youtubeChannelId: YT_ID,
      displayName: "TrackB Test Channel",
      researchStatus: "NEEDS_REVIEW",
    });
    await db.insert(claims).values([
      {
        // Sensitive: the object entity is a PE firm → two-person review (§20.3).
        id: CLAIM_SENSITIVE,
        subjectType: "ENTITY",
        subjectId: CO_ID,
        predicate: "PORTFOLIO_COMPANY_OF",
        objectType: "ENTITY",
        objectId: PE_ID,
        confidence: "0.9",
        claimStatus: "DRAFT",
      },
      {
        // Plain: a corporate owner, not PE, not disputed → one approval publishes.
        id: CLAIM_PLAIN,
        subjectType: "CHANNEL",
        subjectId: CH_ID,
        predicate: "OWNED_BY",
        objectType: "ENTITY",
        objectId: CO_ID,
        confidence: "0.8",
        claimStatus: "DRAFT",
      },
    ]);
    await db.insert(correctionRequests).values({
      id: CORR_ID,
      channelId: CH_ID,
      submitterRelationship: "VIEWER",
      explanation: "A public correction to triage in the reviewer inbox.",
      status: "SUBMITTED",
      submittedAt: new Date(),
    });
  });

  afterAll(async () => {
    await closeDb();
  });

  async function login(email: string): Promise<string> {
    const app = createApp();
    const res = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    expect(res.status).toBe(200);
    return tokenFromResponse(res);
  }

  async function authed(token: string, path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Cookie", `cw_session=${token}`);
    return createApp().request(path, { ...init, headers });
  }

  it("rejects login with wrong credentials (401), accepts correct ones (200 + cookie)", async () => {
    const app = createApp();
    const bad = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "trackb-reviewer-a@test.local", password: "wrong" }),
    });
    expect(bad.status).toBe(401);

    const good = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "trackb-reviewer-a@test.local", password: PASSWORD }),
    });
    expect(good.status).toBe(200);
    const setCookie = good.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("cw_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
  });

  it("guards reviewer endpoints: unauthenticated request is 401", async () => {
    const res = await createApp().request("/api/v1/reviewer/claims");
    expect(res.status).toBe(401);
  });

  it("GET /auth/me returns the signed-in reviewer profile", async () => {
    const token = await login("trackb-reviewer-a@test.local");
    const res = await authed(token, "/api/v1/auth/me");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reviewer: { email: string } };
    expect(body.reviewer.email).toBe("trackb-reviewer-a@test.local");
  });

  it("lists the claim queue and flags the PE claim as sensitive", async () => {
    const token = await login("trackb-reviewer-a@test.local");
    const res = await authed(token, "/api/v1/reviewer/claims?status=DRAFT");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      claims: { id: string; sensitive: boolean; can_publish: boolean }[];
    };
    const sensitive = body.claims.find((c) => c.id === CLAIM_SENSITIVE);
    const plain = body.claims.find((c) => c.id === CLAIM_PLAIN);
    expect(sensitive?.sensitive).toBe(true);
    expect(plain?.sensitive).toBe(false);
  });

  it("publishes a non-sensitive claim on a single approval", async () => {
    const token = await login("trackb-reviewer-a@test.local");
    const res = await authed(token, `/api/v1/reviewer/claims/${CLAIM_PLAIN}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reasoning: "Tier-1 acquisition announcement confirms ownership." }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { published: boolean; claim_status: string };
    expect(body.published).toBe(true);
    expect(body.claim_status).toBe("PUBLISHED");
  });

  it("enforces the §20.3 two-person rule for the sensitive PE claim", async () => {
    const tokenA = await login("trackb-reviewer-a@test.local");

    // First approval by A: held for a second distinct reviewer, NOT published.
    const first = await authed(tokenA, `/api/v1/reviewer/claims/${CLAIM_SENSITIVE}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reasoning: "Investor portfolio listing supports the PE backing." }),
    });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as {
      published: boolean;
      awaiting_second_reviewer: boolean;
      distinct_approvers: number;
    };
    expect(firstBody.published).toBe(false);
    expect(firstBody.awaiting_second_reviewer).toBe(true);
    expect(firstBody.distinct_approvers).toBe(1);

    // The SAME reviewer approving again does NOT satisfy the distinct-reviewer
    // requirement — still not published.
    const dup = await authed(tokenA, `/api/v1/reviewer/claims/${CLAIM_SENSITIVE}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reasoning: "Re-confirming the same evidence basis as before." }),
    });
    const dupBody = (await dup.json()) as { published: boolean; distinct_approvers: number };
    expect(dupBody.published).toBe(false);
    expect(dupBody.distinct_approvers).toBe(1);

    // A SECOND, DISTINCT reviewer (B) approving publishes it.
    const tokenB = await login("trackb-reviewer-b@test.local");
    const second = await authed(tokenB, `/api/v1/reviewer/claims/${CLAIM_SENSITIVE}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reasoning: "Independent second review confirms the PE ownership." }),
    });
    const secondBody = (await second.json()) as { published: boolean; distinct_approvers: number };
    expect(secondBody.published).toBe(true);
    expect(secondBody.distinct_approvers).toBe(2);

    // Every mutation left an audit trail.
    const audits = await getDb()
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.objectId, CLAIM_SENSITIVE));
    expect(audits.filter((a) => a.action === "APPROVE_CLAIM").length).toBeGreaterThanOrEqual(3);
  });

  it("supports entity CRUD with an audit trail", async () => {
    const token = await login("trackb-reviewer-a@test.local");
    const create = await authed(token, "/api/v1/reviewer/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity_type: "COMPANY", canonical_name: "TrackB Created Co" }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as { id: string; canonical_name: string };
    expect(created.canonical_name).toBe("TrackB Created Co");

    const patch = await authed(token, `/api/v1/reviewer/entities/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jurisdiction: "US-DE" }),
    });
    expect(patch.status).toBe(200);
    const patched = (await patch.json()) as { jurisdiction: string };
    expect(patched.jurisdiction).toBe("US-DE");

    const audits = await getDb()
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.objectId, created.id));
    const actions = audits.map((a) => a.action);
    expect(actions).toContain("CREATE_ENTITY");
    expect(actions).toContain("UPDATE_ENTITY");

    // cleanup the created entity + its audit rows
    await getDb().delete(auditEvents).where(eq(auditEvents.objectId, created.id));
    await getDb().delete(entities).where(eq(entities.id, created.id));
  });

  it("resolves a correction from the inbox with reasoning + audit", async () => {
    const token = await login("trackb-reviewer-a@test.local");
    const list = await authed(token, "/api/v1/reviewer/corrections?status=SUBMITTED");
    expect(list.status).toBe(200);
    const listed = (await list.json()) as { corrections: { id: string }[] };
    expect(listed.corrections.some((c) => c.id === CORR_ID)).toBe(true);

    const resolve = await authed(token, `/api/v1/reviewer/corrections/${CORR_ID}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reasoning: "Updated the source citation; correction addressed." }),
    });
    expect(resolve.status).toBe(200);
    const resolved = (await resolve.json()) as { status: string; resolution: string };
    expect(resolved.status).toBe("RESOLVED");

    const audits = await getDb()
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.objectId, CORR_ID));
    expect(audits.some((a) => a.action === "RESOLVE_CORRECTION")).toBe(true);
  });

  it("serves a paginated, subject-filterable audit viewer", async () => {
    const token = await login("trackb-reviewer-a@test.local");
    const res = await authed(token, `/api/v1/reviewer/audit?subjectId=${CLAIM_SENSITIVE}&limit=5`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      count: number;
      limit: number;
      events: { object_id: string | null }[];
    };
    expect(body.limit).toBe(5);
    expect(body.count).toBeGreaterThan(0);
    expect(body.events.every((e) => e.object_id === CLAIM_SENSITIVE)).toBe(true);
  });

  it("logout clears the session so the token no longer authenticates", async () => {
    const token = await login("trackb-reviewer-a@test.local");
    const out = await authed(token, "/api/v1/auth/logout", { method: "POST" });
    expect(out.status).toBe(200);
    // The session row is gone; the same token is now rejected.
    const after = await authed(token, "/api/v1/reviewer/claims");
    expect(after.status).toBe(401);
    // Clean up any sessions left for the test reviewers.
    await getDb().delete(sessions).where(inArray(sessions.reviewerId, [reviewerAId, reviewerBId]));
  });
});
