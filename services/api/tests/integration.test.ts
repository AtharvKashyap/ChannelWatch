import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { deriveClassification } from "@channelwatch/graph";
import { getDb, closeDb } from "../src/db/client.js";
import { auditEvents, channels, entities, relationships } from "../src/db/schema.js";
import { rowToEntity, rowToRelationship } from "../src/db/mappers.js";
import { runSeed } from "../scripts/seed.js";

/**
 * DB-gated integration test. It runs ONLY when DATABASE_URL points at a
 * reachable Postgres; otherwise it skips cleanly with a clear message (CI has no
 * Postgres in M1). Start one with `docker compose up -d postgres`.
 *
 * Flow: migrate -> seed (twice, to prove idempotency) -> read the seeded
 * channel's rows -> map through @channelwatch/schemas -> derive the ownership
 * classification with @channelwatch/graph and assert PE_BACKED (the §35/§26.2
 * acceptance case).
 */

const DATABASE_URL = process.env.DATABASE_URL;

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
    "[integration] SKIPPED: DATABASE_URL is unset or unreachable. " +
      "Run `docker compose up -d postgres` and set DATABASE_URL to enable these tests.",
  );
}

describe.skipIf(!reachable)("services/api integration (§35 acceptance)", () => {
  beforeAll(async () => {
    const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
    const sql = postgres(DATABASE_URL!, { max: 1, onnotice: () => {} });
    try {
      await migrate(drizzle(sql), { migrationsFolder });
    } finally {
      await sql.end({ timeout: 5 });
    }
    // Seed twice: the second run must be a no-op (idempotency).
    await runSeed();
    await runSeed();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("derives PE_BACKED from the seeded §35 ownership chain", async () => {
    const db = getDb();
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.youtubeChannelId, "UC123456789"));
    expect(channel).toBeDefined();

    const entityRows = await db.select().from(entities);
    const relationshipRows = await db.select().from(relationships);

    const mappedEntities = entityRows.map(rowToEntity);
    const mappedRelationships = relationshipRows.map(rowToRelationship);

    const result = deriveClassification({
      channelId: channel!.id,
      relationships: mappedRelationships,
      entities: mappedEntities,
      asOf: new Date("2026-07-21T00:00:00Z"),
      lastReviewedAt: channel!.lastReviewedAt,
    });

    expect(result.classification).toBe("PE_BACKED");
    expect(result.directOwner?.name).toBe("Example Media LLC");
    expect(result.directOwner?.type).toBe("COMPANY");
    expect(result.ultimateParent?.name).toBe("Example Capital Partners");
    expect(result.ultimateParent?.type).toBe("PRIVATE_EQUITY_FIRM");
    expect(result.explanationCodes).toEqual(
      expect.arrayContaining(["DIRECT_OWNER_CONFIRMED", "OWNER_IS_PE_PORTFOLIO_COMPANY"]),
    );
    expect(result.confidence).toBeCloseTo(0.93, 10);
  });

  it("is idempotent: two seed runs produce exactly one §35 record set", async () => {
    const db = getDb();
    const channelRows = await db
      .select()
      .from(channels)
      .where(eq(channels.youtubeChannelId, "UC123456789"));
    expect(channelRows).toHaveLength(1);

    // 3 entities, 3 relationships seeded; no duplicates after the second run.
    expect(await db.select().from(entities)).toHaveLength(3);
    expect(await db.select().from(relationships)).toHaveLength(3);

    // Audit rows are append-only but deduped by deterministic id: one set only.
    const audits = await db.select().from(auditEvents);
    expect(audits.length).toBeGreaterThan(0);
    const seedUpserts = audits.filter((a) => a.action === "SEED_UPSERT");
    // reviewer + channel + 3 entities + 3 relationships + 3 sources + 2 claims
    // + 3 claim_sources + 1 review = 17 distinct objects.
    expect(seedUpserts).toHaveLength(17);
  });
});
