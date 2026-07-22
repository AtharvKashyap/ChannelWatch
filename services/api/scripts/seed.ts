import { fileURLToPath } from "node:url";
import {
  ClassificationLabelSchema,
  ClaimStatusSchema,
  ControlLevelSchema,
  EntityTypeSchema,
  EvidenceStatusSchema,
  RelationshipStatusSchema,
  RelationshipTypeSchema,
  ResearchStatusSchema,
  SourceTierSchema,
  SourceTypeSchema,
} from "@channelwatch/schemas";
import { getDb, closeDb, type Database } from "../src/db/client.js";
import {
  auditId,
  channelId,
  claimId,
  claimSourceId,
  entityId,
  relationshipId,
  reviewId,
  reviewerId,
  sourceId,
} from "../src/db/deterministic-ids.js";
import {
  auditEvents,
  channels,
  claims,
  claimSources,
  entities,
  relationships,
  reviewers,
  reviews,
  sources,
} from "../src/db/schema.js";

/**
 * Seed the SPEC §35 "Example Channel" record. Idempotent: every row uses a
 * deterministic UUID derived from its natural key, and inserts use
 * ON CONFLICT DO NOTHING, so running the seed any number of times converges to
 * the same state with no duplicates (including audit rows).
 *
 * Every mutation writes an `audit_events` row (project rule). Enum-valued
 * columns are validated through `@channelwatch/schemas` before insert (the Zod
 * enums are the boundary of record) — a bad value fails loudly here rather than
 * silently entering the database.
 *
 * SOURCE-TYPE MAPPING: §35's evidence `type` labels are prose, not enum members.
 * They map onto the §14.1 `SOURCE_TYPES` enum as:
 *   OFFICIAL_ACQUISITION_ANNOUNCEMENT -> OFFICIAL_ACQUISITION_ANNOUNCEMENT (exact)
 *   INVESTOR_PORTFOLIO_PAGE           -> INVESTOR_PORTFOLIO_LISTING
 *   TRADE_PUBLICATION                 -> ESTABLISHED_INDUSTRY_PUBLICATION
 * The youtube_channel_id "UC123456789" is the §35 placeholder verbatim (a TEXT
 * column, not validated against the canonical-id regex, which the seed does not
 * apply to this fixture).
 */

// ---- Deterministic ids for the §35 record --------------------------------
// Ids are derived from STABLE LOGICAL IDENTITY via the shared builders in
// `src/db/deterministic-ids.ts` — the exact same natural-key scheme the
// research-record importer uses. This is what makes the two write paths
// converge on identical ids for the same logical record (channel by
// youtube_channel_id, entity by canonical_name, relationship by
// subject-id:type:object-id, source by url, claim by subject-id:predicate:
// object-id), so neither path can produce a duplicate of a row the other wrote.
const channel = channelId("UC123456789");
const media = entityId("Example Media LLC");
const capital = entityId("Example Capital Partners");
const creator = entityId("Original Creator");
const claimOwned = claimId(channel, "OWNED_BY", media);

const ids = {
  reviewer: reviewerId("dev@channelwatch.local"),
  channel,
  media,
  capital,
  creator,
  relOwns: relationshipId(media, "OWNS", channel),
  relPortfolio: relationshipId(media, "PORTFOLIO_COMPANY_OF", capital),
  relHost: relationshipId(channel, "HOSTED_BY", creator),
  srcAcq: sourceId("https://example.com/press/example-media-acquires-example-channel"),
  srcPortfolio: sourceId("https://examplecapital.com/portfolio/example-media"),
  srcTrade: sourceId("https://tradepress.example/example-media-expands-creator-portfolio"),
  claimOwned,
  claimPortfolio: claimId(media, "PORTFOLIO_COMPANY_OF", capital),
  review: reviewId(claimOwned),
} as const;

/** Seed all §35 rows. Reusable from the integration test. */
export async function runSeed(db: Database = getDb()): Promise<typeof ids> {
  // Boundary validation of every enum-valued value before it reaches the DB.
  const reviewerRole = "REVIEWER";
  const researchStatus = ResearchStatusSchema.parse("PUBLISHED");
  const classification = ClassificationLabelSchema.parse("PE_BACKED");
  const controlling = ControlLevelSchema.parse("CONTROLLING");
  const controlUnknown = ControlLevelSchema.parse("UNKNOWN");
  const active = RelationshipStatusSchema.parse("ACTIVE");
  const relOwns = RelationshipTypeSchema.parse("OWNS");
  const relPortfolio = RelationshipTypeSchema.parse("PORTFOLIO_COMPANY_OF");
  const relHosted = RelationshipTypeSchema.parse("HOSTED_BY");
  const evidenceActive = EvidenceStatusSchema.parse("ACTIVE");
  const claimPublished = ClaimStatusSchema.parse("PUBLISHED");

  const auditRows: (typeof auditEvents.$inferInsert)[] = [];
  const audit = (objectType: string, objectId: string, after: unknown): void => {
    auditRows.push({
      id: auditId("SEED_UPSERT", objectId),
      actorId: ids.reviewer,
      action: "SEED_UPSERT",
      objectType,
      objectId,
      afterState: after as object,
    });
  };

  // ---- reviewer ----------------------------------------------------------
  const reviewerRow = {
    id: ids.reviewer,
    email: "dev@channelwatch.local",
    displayName: "Development Reviewer",
    role: reviewerRole,
  };
  await db.insert(reviewers).values(reviewerRow).onConflictDoNothing({ target: reviewers.id });
  audit("reviewer", ids.reviewer, reviewerRow);

  // ---- channel -----------------------------------------------------------
  const channelRow = {
    id: ids.channel,
    youtubeChannelId: "UC123456789",
    handle: "@examplechannel",
    displayName: "Example Channel",
    researchStatus,
    publishedClassification: classification,
    classificationConfidence: "0.93",
    lastReviewedAt: new Date("2026-07-18T00:00:00Z"),
    firstSeenAt: new Date("2017-06-04T00:00:00Z"),
  };
  await db.insert(channels).values(channelRow).onConflictDoNothing({ target: channels.id });
  audit("channel", ids.channel, channelRow);

  // ---- entities (2 entities + PE firm) -----------------------------------
  const entityRows = [
    {
      id: ids.media,
      entityType: EntityTypeSchema.parse("COMPANY"),
      canonicalName: "Example Media LLC",
      legalName: "Example Media LLC",
    },
    {
      id: ids.capital,
      entityType: EntityTypeSchema.parse("PRIVATE_EQUITY_FIRM"),
      canonicalName: "Example Capital Partners",
      legalName: "Example Capital Partners, L.P.",
    },
    {
      id: ids.creator,
      entityType: EntityTypeSchema.parse("CREATOR"),
      canonicalName: "Original Creator",
    },
  ];
  await db.insert(entities).values(entityRows).onConflictDoNothing({ target: entities.id });
  for (const row of entityRows) audit("entity", row.id, row);

  // ---- relationships (OWNS chain per §35 direct_owner/ultimate_parent) ----
  const relationshipRows = [
    {
      id: ids.relOwns,
      subjectEntityId: ids.media,
      objectChannelId: ids.channel,
      relationshipType: relOwns,
      controlLevel: controlling,
      effectiveFrom: "2025-03-12",
      confidence: "0.93",
      status: active,
    },
    {
      id: ids.relPortfolio,
      subjectEntityId: ids.media,
      objectEntityId: ids.capital,
      relationshipType: relPortfolio,
      controlLevel: controlUnknown,
      confidence: "0.93",
      status: active,
    },
    {
      id: ids.relHost,
      subjectChannelId: ids.channel,
      objectEntityId: ids.creator,
      relationshipType: relHosted,
      controlLevel: controlUnknown,
      confidence: "0.8",
      status: active,
    },
  ];
  await db
    .insert(relationships)
    .values(relationshipRows)
    .onConflictDoNothing({ target: relationships.id });
  for (const row of relationshipRows) audit("relationship", row.id, row);

  // ---- sources (3, §35 evidence) -----------------------------------------
  const sourceRows = [
    {
      id: ids.srcAcq,
      url: "https://example.com/press/example-media-acquires-example-channel",
      title: "Example Media Acquires Example Channel",
      publisher: "Example Media",
      publishedAt: new Date("2025-03-12T00:00:00Z"),
      sourceTier: SourceTierSchema.parse(1),
      sourceType: SourceTypeSchema.parse("OFFICIAL_ACQUISITION_ANNOUNCEMENT"),
      status: evidenceActive,
    },
    {
      id: ids.srcPortfolio,
      url: "https://examplecapital.com/portfolio/example-media",
      title: "Example Media Portfolio Listing",
      publisher: "Example Capital Partners",
      sourceTier: SourceTierSchema.parse(1),
      sourceType: SourceTypeSchema.parse("INVESTOR_PORTFOLIO_LISTING"),
      status: evidenceActive,
    },
    {
      id: ids.srcTrade,
      url: "https://tradepress.example/example-media-expands-creator-portfolio",
      title: "Example Media Expands Creator Portfolio",
      publisher: "Trade Press",
      publishedAt: new Date("2025-03-13T00:00:00Z"),
      sourceTier: SourceTierSchema.parse(2),
      sourceType: SourceTypeSchema.parse("ESTABLISHED_INDUSTRY_PUBLICATION"),
      status: evidenceActive,
    },
  ];
  await db.insert(sources).values(sourceRows).onConflictDoNothing({ target: sources.id });
  for (const row of sourceRows) audit("source", row.id, row);

  // ---- claims (published) ------------------------------------------------
  const claimRows = [
    {
      id: ids.claimOwned,
      subjectType: "CHANNEL",
      subjectId: ids.channel,
      predicate: "OWNED_BY",
      objectType: "ENTITY",
      objectId: ids.media,
      confidence: "0.93",
      claimStatus: claimPublished,
      effectiveDate: "2025-03-12",
    },
    {
      id: ids.claimPortfolio,
      subjectType: "ENTITY",
      subjectId: ids.media,
      predicate: "PORTFOLIO_COMPANY_OF",
      objectType: "ENTITY",
      objectId: ids.capital,
      confidence: "0.93",
      claimStatus: claimPublished,
    },
  ];
  await db.insert(claims).values(claimRows).onConflictDoNothing({ target: claims.id });
  for (const row of claimRows) audit("claim", row.id, row);

  // ---- claim_sources (evidence links) ------------------------------------
  const claimSourceRows = [
    { claimId: ids.claimOwned, sourceId: ids.srcAcq, supportType: "SUPPORTS" },
    { claimId: ids.claimOwned, sourceId: ids.srcTrade, supportType: "CORROBORATES" },
    { claimId: ids.claimPortfolio, sourceId: ids.srcPortfolio, supportType: "SUPPORTS" },
  ];
  await db
    .insert(claimSources)
    .values(claimSourceRows)
    .onConflictDoNothing({ target: [claimSources.claimId, claimSources.sourceId] });
  for (const row of claimSourceRows) {
    // claim_sources has a composite key, not a single uuid; the audit row's
    // object_id is a uuid column, so derive a stable one for the pair.
    audit("claim_source", claimSourceId(row.claimId, row.sourceId), row);
  }

  // ---- review ------------------------------------------------------------
  const reviewRow = {
    id: ids.review,
    claimId: ids.claimOwned,
    reviewerId: ids.reviewer,
    decision: "APPROVED",
    reasoning: "Tier 1 acquisition announcement plus investor portfolio listing.",
    reviewedAt: new Date("2026-07-18T00:00:00Z"),
  };
  await db.insert(reviews).values(reviewRow).onConflictDoNothing({ target: reviews.id });
  audit("review", ids.review, reviewRow);

  // ---- audit_events (one per upserted object; append-only, deduped by id) -
  await db.insert(auditEvents).values(auditRows).onConflictDoNothing({ target: auditEvents.id });

  return ids;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set (see .env.example).");
  }
  await runSeed();
  console.log("seed complete (SPEC §35 Example Channel record)");
  await closeDb();
}

// Run only when invoked directly (not when imported by tests). Compare decoded
// paths via fileURLToPath so directories containing spaces (which import.meta.url
// percent-encodes) still match process.argv[1].
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { ids as seedIds };
