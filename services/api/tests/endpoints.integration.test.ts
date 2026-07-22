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
import { auditEvents, channels } from "../src/db/schema.js";
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
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.9" },
        body: JSON.stringify({ youtube_channel_id: LBB_YT_ID }),
      });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await send()).status);
    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(statuses[5]).toBe(429);
  });
});
