import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { getDb, closeDb } from "../src/db/client.js";
import { auditEvents, channels } from "../src/db/schema.js";
import {
  importAll,
  recomputeClassifications,
  type ImportSummary,
} from "../scripts/import-research.js";

/**
 * DB-gated importer integration test. Runs ONLY when DATABASE_URL points at a
 * reachable Postgres; otherwise it skips cleanly (CI has no Postgres in M1).
 *
 * Flow: migrate -> import the §35 fixture (--include-fixtures) -> assert the
 * COMPUTED classification is PE_BACKED and audit rows exist -> import again and
 * assert the second run is a true no-op (zero changes, zero new audit rows).
 */

const DATABASE_URL = process.env.DATABASE_URL;
const FIXTURE_FILE = "example-channel.yaml";
const FIXTURE_CHANNEL_ID = "UCExampleFixtureChannel1";
const researchDir = fileURLToPath(new URL("../../../data/research", import.meta.url));

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
    "[import-research] SKIPPED: DATABASE_URL is unset or unreachable. " +
      "Run `docker compose up -d postgres` and set DATABASE_URL to enable these tests.",
  );
}

describe.skipIf(!reachable)("import-research (§35 fixture)", () => {
  let firstRun: ImportSummary[];
  let secondRun: ImportSummary[];
  let auditAfterFirst: number;
  let auditAfterSecond: number;

  const importCount = async (): Promise<number> => {
    const rows = await getDb()
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "IMPORT_RESEARCH_RECORD"));
    return rows.length;
  };

  beforeAll(async () => {
    const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
    const sql = postgres(DATABASE_URL!, { max: 1, onnotice: () => {} });
    try {
      await migrate(drizzle(sql), { migrationsFolder });
    } finally {
      await sql.end({ timeout: 5 });
    }
    firstRun = await importAll(getDb(), { includeFixtures: true, dir: researchDir });
    auditAfterFirst = await importCount();
    secondRun = await importAll(getDb(), { includeFixtures: true, dir: researchDir });
    auditAfterSecond = await importCount();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("derives and stores PE_BACKED for the fixture channel", async () => {
    const summary = firstRun.find((s) => s.file === FIXTURE_FILE);
    expect(summary).toBeDefined();
    expect(summary!.classification).toBe("PE_BACKED");
    expect(summary!.classificationConfidence).toBeCloseTo(0.93, 10);

    const [channel] = await getDb()
      .select()
      .from(channels)
      .where(eq(channels.youtubeChannelId, FIXTURE_CHANNEL_ID));
    expect(channel).toBeDefined();
    expect(channel!.publishedClassification).toBe("PE_BACKED");
    expect(Number(channel!.classificationConfidence)).toBeCloseTo(0.93, 10);
    expect(channel!.lastReviewedAt).not.toBeNull();
  });

  it("wrote audit events for the import", () => {
    expect(auditAfterFirst).toBeGreaterThan(0);
  });

  it("is idempotent: the second run changes nothing and writes no audit rows", () => {
    const summary = secondRun.find((s) => s.file === FIXTURE_FILE);
    expect(summary).toBeDefined();
    expect(summary!.changed).toBe(0);
    expect(summary!.auditWritten).toBe(0);
    expect(auditAfterSecond).toBe(auditAfterFirst);
  });

  it("whole-graph recompute keeps the cached label consistent and is idempotent", async () => {
    // First recompute may rewrite labels that differ between the per-record import
    // and the whole-graph serve; the fixture channel stays PE_BACKED regardless.
    const first = await recomputeClassifications(getDb());
    const fixtureRow = first.find((r) => r.youtubeChannelId === FIXTURE_CHANNEL_ID);
    expect(fixtureRow).toBeDefined();
    expect(fixtureRow!.classification).toBe("PE_BACKED");

    const [channel] = await getDb()
      .select()
      .from(channels)
      .where(eq(channels.youtubeChannelId, FIXTURE_CHANNEL_ID));
    expect(channel!.publishedClassification).toBe("PE_BACKED");

    // A second recompute over the unchanged graph rewrites nothing.
    const second = await recomputeClassifications(getDb());
    expect(second.every((r) => r.changed === false)).toBe(true);
  });
});
