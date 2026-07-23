import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import {
  ChannelLookupPayload,
  EDITORIAL_DISCLAIMER,
  UNRESEARCHED_SUMMARY,
} from "@channelwatch/schemas";
import { createApp } from "../src/index.js";
import { getDb, closeDb } from "../src/db/client.js";
import { auditEvents, channels, entities, relationships } from "../src/db/schema.js";
import { importAll } from "../scripts/import-research.js";

/**
 * DB-gated HTTP integration tests for the public §17 endpoints. Runs ONLY when
 * DATABASE_URL points at a reachable Postgres; otherwise skips cleanly (CI
 * without Postgres). Flow: migrate -> import the research dataset (idempotent)
 * -> exercise every endpoint through the Hono app (no port bound) against the
 * imported pilot data, with Little Baby Bum (PE_BACKED) as the prime fixture.
 */

const DATABASE_URL = process.env.DATABASE_URL;
const LBB_YT_ID = "UCKAqou7V9FAWXpZd9xtOg3Q";

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
    "[endpoints] SKIPPED: DATABASE_URL is unset or unreachable. " +
      "Run `docker compose up -d postgres`, migrate + import, and set DATABASE_URL.",
  );
}

describe.skipIf(!reachable)("public API endpoints (§17)", () => {
  let lbbChannelId: string;

  beforeAll(async () => {
    const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
    const sql = postgres(DATABASE_URL!, { max: 1, onnotice: () => {} });
    try {
      await migrate(drizzle(sql), { migrationsFolder });
    } finally {
      await sql.end({ timeout: 5 });
    }
    await importAll(getDb(), { includeFixtures: false });
    const [row] = await getDb()
      .select()
      .from(channels)
      .where(eq(channels.youtubeChannelId, LBB_YT_ID));
    expect(row).toBeDefined();
    lbbChannelId = row!.id;
  });

  afterAll(async () => {
    await closeDb();
  });

  it("GET /channels/youtube/:id returns §17.2-shaped PE_BACKED JSON for Little Baby Bum", async () => {
    const app = createApp();
    const res = await app.request(`/api/v1/channels/youtube/${LBB_YT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.json();

    // Validates against the published payload schema (§17.2 + extension fields).
    const payload = ChannelLookupPayload.parse(body);
    expect(payload.researched).toBe(true);
    if (!payload.researched) throw new Error("expected researched payload");

    expect(payload.youtube_channel_id).toBe(LBB_YT_ID);
    expect(payload.classification.label).toBe("PE_BACKED");
    expect(payload.badge_color).toBe("ORANGE"); // §9.2: PE is orange, never red
    expect(payload.disclaimer).toBe(EDITORIAL_DISCLAIMER);
    expect(payload.direct_owner?.name).toBe("Moonbug Entertainment");
    expect(payload.ultimate_parent?.type).toBe("PRIVATE_EQUITY_FIRM");
    expect(payload.classification.summary).toContain("Moonbug Entertainment");
    expect(payload.classification.summary).toContain("portfolio company");
    expect(payload.evidence_count).toBeGreaterThan(0);
    expect(payload.disputed).toBe(false);

    // Standard rate-limit headers are present on reads.
    expect(res.headers.get("RateLimit-Limit")).toBe("60");
  });

  it("carries the additive 3-hop ownership_chain (Moonbug → Candle Media → Blackstone) for Little Baby Bum", async () => {
    const app = createApp();
    const res = await app.request(`/api/v1/channels/youtube/${LBB_YT_ID}`);
    expect(res.status).toBe(200);
    const payload = ChannelLookupPayload.parse(await res.json());
    if (!payload.researched) throw new Error("expected researched payload");

    // Chain, channel-owner upward: the direct owner (Moonbug), its corporate
    // parent (Candle Media), and the ultimate PE backer (Blackstone).
    const chain = payload.ownership_chain ?? [];
    expect(chain.map((s) => s.name)).toEqual([
      "Moonbug Entertainment",
      "Candle Media",
      "Blackstone Inc.",
    ]);
    // Blackstone is reached via a portfolio-company relationship; the sources
    // disclose no percentage, so every hop's percentage is null (legal-safe).
    expect(chain.map((s) => s.relationship)).toEqual(["OWNS", "OWNS", "PORTFOLIO_COMPANY_OF"]);
    expect(chain.every((s) => s.ownership_percentage === null)).toBe(true);
    expect(chain.at(-1)?.type).toBe("PRIVATE_EQUITY_FIRM");

    // The direct owner carries a neutral, sourced mechanism phrase.
    expect(payload.direct_owner?.name).toBe("Moonbug Entertainment");
    expect(payload.direct_owner?.mechanism).toBe("controlling stake");
  });

  it("carries the additive ownership_history for Little Baby Bum (current owners, newest-first)", async () => {
    const app = createApp();
    const res = await app.request(`/api/v1/channels/youtube/${LBB_YT_ID}`);
    expect(res.status).toBe(200);
    const payload = ChannelLookupPayload.parse(await res.json());
    if (!payload.researched) throw new Error("expected researched payload");

    const history = payload.ownership_history ?? [];
    expect(history.length).toBeGreaterThan(0);
    // Moonbug owns the channel and Candle owns Moonbug — both are surfaced.
    const names = history.map((h) => h.name);
    expect(names).toContain("Moonbug Entertainment");
    expect(names).toContain("Candle Media");
    // No transition here, so every surfaced period is current; percentages are
    // undisclosed in the sources, so they are null (legal-safe, never inferred).
    expect(history.every((h) => h.is_current)).toBe(true);
    // Candle's OWNS→Moonbug edge is dated 2021-11-04; the newest transition tops.
    expect(history[0]?.effective_from).toBe("2021-11-04");
  });

  it("carries prior owners in ownership_history for a channel with an ownership transition (Smosh)", async () => {
    const SMOSH_YT_ID = "UCY30JRSgfhYXA6i6xX1erWg";
    const app = createApp();
    const res = await app.request(`/api/v1/channels/youtube/${SMOSH_YT_ID}`);
    expect(res.status).toBe(200);
    const payload = ChannelLookupPayload.parse(await res.json());
    if (!payload.researched) throw new Error("expected researched payload");

    const history = payload.ownership_history ?? [];
    const names = history.map((h) => h.name);
    // Current creator co-owners plus the documented prior owners.
    expect(names).toContain("Mythical Entertainment");
    expect(names).toContain("Defy Media");
    // The prior owners are marked not-current; at least one current period exists.
    const mythicalFormer = history.find(
      (h) => h.name === "Mythical Entertainment" && h.relationship === "FORMERLY_OWNED_BY",
    );
    expect(mythicalFormer?.is_current).toBe(false);
    expect(mythicalFormer?.effective_to).toBe("2023-06-20");
    expect(history.some((h) => h.is_current)).toBe(true);
    // Defy's period has no documented dates (never inferred), so it is undated and
    // sorts into the undated tail; the first (top) period is a dated, recent one.
    const defy = history.find((h) => h.name === "Defy Media");
    expect(defy?.effective_from).toBeNull();
    expect(defy?.is_current).toBe(false);
    expect(history[0]?.effective_from).not.toBeNull();
  });

  it("GET /channels/youtube/:id returns a neutral UNRESEARCHED 200 for an unknown channel", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/channels/youtube/UCaaaaaaaaaaaaaaaaaaaaaa");
    expect(res.status).toBe(200);
    const payload = ChannelLookupPayload.parse(await res.json());
    expect(payload.researched).toBe(false);
    if (payload.researched) throw new Error("expected unresearched payload");
    expect(payload.research_status).toBe("UNRESEARCHED");
    expect(payload.summary).toBe(UNRESEARCHED_SUMMARY);
  });

  it("GET /channels/youtube/:id 400s on a malformed channel id", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/channels/youtube/not-a-channel-id");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_CHANNEL_ID");
  });

  it("GET /channels/search finds Little Baby Bum by display name", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/channels/search?q=baby");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: { youtube_channel_id: string; classification: string }[];
    };
    const hit = body.results.find((r) => r.youtube_channel_id === LBB_YT_ID);
    expect(hit).toBeDefined();
    expect(hit!.classification).toBe("PE_BACKED");
  });

  it("GET /channels/search 400s without a query", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/channels/search");
    expect(res.status).toBe(400);
  });

  it("GET /channels/:id/ownership returns the chain with entities", async () => {
    const app = createApp();
    const res = await app.request(`/api/v1/channels/${lbbChannelId}/ownership`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      classification: string;
      direct_owner: { name: string } | null;
      ultimate_parent: { name: string } | null;
      chain: unknown[];
      relationships: unknown[];
    };
    expect(body.classification).toBe("PE_BACKED");
    expect(body.direct_owner?.name).toBe("Moonbug Entertainment");
    expect(body.ultimate_parent?.name).toBe("Blackstone Inc.");
    expect(body.chain.length).toBeGreaterThanOrEqual(2);
    expect(body.relationships.length).toBeGreaterThanOrEqual(3);
  });

  it("GET /channels/:id/evidence returns tiered sources with excerpts", async () => {
    const app = createApp();
    const res = await app.request(`/api/v1/channels/${lbbChannelId}/evidence`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      evidence_count: number;
      evidence: { tier: number | null; status: string | null; excerpt: string | null }[];
    };
    expect(body.evidence_count).toBeGreaterThan(0);
    expect(body.evidence.some((e) => e.tier === 1)).toBe(true);
    expect(body.evidence.some((e) => typeof e.excerpt === "string" && e.excerpt.length > 0)).toBe(
      true,
    );
  });

  it("GET /channels/:id/timeline returns events ordered by effective date", async () => {
    const app = createApp();
    const res = await app.request(`/api/v1/channels/${lbbChannelId}/timeline`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: { date: string | null }[] };
    expect(body.events.length).toBeGreaterThan(0);
    const dated = body.events.map((e) => e.date).filter((d): d is string => d !== null);
    const sorted = [...dated].sort((a, b) => a.localeCompare(b));
    expect(dated).toEqual(sorted);
  });

  it("GET /channels/:id/ownership 404s for an unknown channel id", async () => {
    const app = createApp();
    const res = await app.request(
      "/api/v1/channels/00000000-0000-4000-8000-000000000000/ownership",
    );
    expect(res.status).toBe(404);
  });

  it("GET /channels/:id/ownership 400s for a non-UUID id", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/channels/not-a-uuid/ownership");
    expect(res.status).toBe(400);
  });

  it("GET /entities/:id returns the entity with type", async () => {
    const app = createApp();
    // Resolve Blackstone's entity id via the ownership response.
    const own = (await (
      await createApp().request(`/api/v1/channels/${lbbChannelId}/ownership`)
    ).json()) as { ultimate_parent: { id: string } };
    const res = await app.request(`/api/v1/entities/${own.ultimate_parent.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entity_type: string; canonical_name: string };
    expect(body.entity_type).toBe("PRIVATE_EQUITY_FIRM");
    expect(body.canonical_name).toBe("Blackstone Inc.");
  });

  it("GET /entities/:id 404s for an unknown entity", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/entities/00000000-0000-4000-8000-000000000000");
    expect(res.status).toBe(404);
  });

  it("POST /corrections validates, persists, and writes an audit event", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        youtube_channel_id: LBB_YT_ID,
        explanation: "The Blackstone stake characterization needs a source update per new filing.",
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; status: string };
    expect(body.status).toBe("SUBMITTED");

    const audits = await getDb()
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.objectId, body.id));
    expect(audits).toHaveLength(1);
    expect(audits[0]!.action).toBe("SUBMIT_CORRECTION");
  });

  it("POST /corrections 400s on an invalid body", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ youtube_channel_id: "@bad", explanation: "short" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("POST /submissions persists a research lead and audits it", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        youtube_channel_id: LBB_YT_ID,
        evidence_url: "https://example.com/new-evidence",
        note: "Possible ownership change to investigate.",
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    const audits = await getDb()
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.objectId, body.id));
    expect(audits[0]!.action).toBe("SUBMIT_RESEARCH_LEAD");
  });

  it("enforces the 5/min POST rate limit per IP", async () => {
    const app = createApp();
    const send = () =>
      app.request("/api/v1/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtube_channel_id: LBB_YT_ID }),
      });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await send()).status);
    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(statuses[5]).toBe(429);
  });

  it("rejects an over-limit POST body with 413 before parsing", async () => {
    const app = createApp();
    const huge = "x".repeat(40 * 1024); // 40KB > 32KB cap
    const res = await app.request("/api/v1/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ youtube_channel_id: LBB_YT_ID, note: huge }),
    });
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("degrades (not 500s) when a channel's sub-graph has an unmappable relationship", async () => {
    const db = getDb();
    const BAD_YT_ID = "UCzzzzzzzzzzzzzzzzzzzzzz";
    // A real entity to satisfy the relationships.subject_entity_id FK.
    const [anEntity] = await db.select().from(entities).limit(1);
    expect(anEntity).toBeDefined();

    const [tmpChannel] = await db
      .insert(channels)
      .values({
        youtubeChannelId: BAD_YT_ID,
        displayName: "Temp Degraded Channel",
        researchStatus: "PUBLISHED",
        publishedClassification: "CORPORATE_OWNED",
        classificationConfidence: "0.8",
      })
      .returning();
    const [badRel] = await db
      .insert(relationships)
      .values({
        subjectEntityId: anEntity!.id,
        objectChannelId: tmpChannel!.id,
        // Not a member of the RelationshipType enum → rowToRelationship throws.
        relationshipType: "NOT_A_REAL_TYPE",
        status: "ACTIVE",
      })
      .returning();

    try {
      const app = createApp();
      const res = await app.request(`/api/v1/channels/youtube/${BAD_YT_ID}`);
      // The unmappable row is skipped, not thrown: the request succeeds and the
      // classifier falls back to the cached published label.
      expect(res.status).toBe(200);
      const payload = ChannelLookupPayload.parse(await res.json());
      expect(payload.researched).toBe(true);
      if (!payload.researched) throw new Error("expected researched payload");
      expect(payload.classification.label).toBe("CORPORATE_OWNED");
    } finally {
      await db.delete(relationships).where(eq(relationships.id, badRel!.id));
      await db.delete(channels).where(eq(channels.id, tmpChannel!.id));
    }
  });
});
