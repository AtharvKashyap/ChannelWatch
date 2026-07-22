import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
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
  type Entity as GraphEntity,
  type Relationship as GraphRelationship,
} from "@channelwatch/schemas";
import { deriveClassification } from "@channelwatch/graph";
import { getDb, closeDb, type Database } from "../src/db/client.js";
import { syncRow } from "../src/db/sync-row.js";
import {
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
 * Seed the SPEC §35 "Example Channel" record. Idempotent AND change-detected:
 * every row uses a deterministic UUID derived from its natural key, and writes
 * go through the shared `syncRow` helper — the exact same change-detection the
 * research-record importer uses. A row is INSERTed/UPDATEd (and only then emits
 * an `audit_events` row) only when its content actually differs from what is
 * stored. Re-running the seed converges to the same state with zero extra
 * writes and zero new audit rows.
 *
 * The channel's classification is COMPUTED from the seeded ownership edges via
 * `@channelwatch/graph` (never a hardcoded label): the §35 chain — Example Media
 * OWNS the channel and is a PORTFOLIO_COMPANY_OF a PRIVATE_EQUITY_FIRM — derives
 * PE_BACKED. This keeps the seed honest: the badge it writes is the badge the
 * derivation produces, not an asserted literal.
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
  const controlling = ControlLevelSchema.parse("CONTROLLING");
  const controlUnknown = ControlLevelSchema.parse("UNKNOWN");
  const active = RelationshipStatusSchema.parse("ACTIVE");
  const relOwns = RelationshipTypeSchema.parse("OWNS");
  const relPortfolio = RelationshipTypeSchema.parse("PORTFOLIO_COMPANY_OF");
  const relHosted = RelationshipTypeSchema.parse("HOSTED_BY");
  const evidenceActive = EvidenceStatusSchema.parse("ACTIVE");
  const claimPublished = ClaimStatusSchema.parse("PUBLISHED");

  // ---- entity + relationship definitions (single source for both the DB rows
  // and the classification derivation) -----------------------------------
  const entityDefs = [
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

  const relationshipDefs = [
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

  // ---- COMPUTE the classification from the seeded ownership edges --------
  const graphEntities: GraphEntity[] = entityDefs.map((e) => ({
    id: e.id,
    name: e.canonicalName,
    type: e.entityType,
  }));
  const graphRelationships: GraphRelationship[] = relationshipDefs.map((r) => ({
    type: r.relationshipType,
    from_entity_id: r.subjectEntityId ?? r.subjectChannelId!,
    to_entity_id: r.objectEntityId ?? r.objectChannelId!,
    effective_from: r.effectiveFrom ?? null,
    effective_to: null,
    ownership_percentage: null,
    control_level: r.controlLevel,
    confidence: Number(r.confidence),
    source_ids: [],
    status: r.status,
  }));
  const lastReviewedAt = new Date("2026-07-18T00:00:00Z");
  const derived = deriveClassification({
    channelId: ids.channel,
    relationships: graphRelationships,
    entities: graphEntities,
    asOf: new Date("2026-07-18T00:00:00Z"),
    lastReviewedAt,
  });
  const classification = ClassificationLabelSchema.parse(derived.classification);
  const classificationConfidence = String(derived.confidence);

  // ---- change-detected writes + audit collection -------------------------
  const auditRows: (typeof auditEvents.$inferInsert)[] = [];
  const audit = (objectType: string, objectId: string, before: unknown, after: unknown): void => {
    auditRows.push({
      actorId: ids.reviewer,
      action: "SEED_UPSERT",
      objectType,
      objectId,
      beforeState: (before ?? null) as object | null,
      afterState: (after ?? null) as object | null,
    });
  };
  const record_ = async (
    objectType: string,
    objectId: string,
    r: Awaited<ReturnType<typeof syncRow>>,
  ): Promise<void> => {
    if (r.result === "unchanged") return;
    audit(objectType, objectId, r.before, r.after);
  };

  await db.transaction(async (tx) => {
    // ---- reviewer --------------------------------------------------------
    await record_(
      "reviewer",
      ids.reviewer,
      await syncRow(tx, reviewers, ids.reviewer, {
        email: "dev@channelwatch.local",
        displayName: "Development Reviewer",
        role: reviewerRole,
      }),
    );

    // ---- channel (with COMPUTED classification) --------------------------
    await record_(
      "channel",
      ids.channel,
      await syncRow(tx, channels, ids.channel, {
        youtubeChannelId: "UC123456789",
        handle: "@examplechannel",
        displayName: "Example Channel",
        researchStatus,
        publishedClassification: classification,
        classificationConfidence,
        lastReviewedAt,
        firstSeenAt: new Date("2017-06-04T00:00:00Z"),
      }),
    );

    // ---- entities --------------------------------------------------------
    for (const def of entityDefs) {
      const { id, ...cols } = def;
      await record_("entity", id, await syncRow(tx, entities, id, cols));
    }

    // ---- relationships ---------------------------------------------------
    for (const def of relationshipDefs) {
      const { id, ...cols } = def;
      await record_("relationship", id, await syncRow(tx, relationships, id, cols));
    }

    // ---- sources ---------------------------------------------------------
    const sourceDefs = [
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
    for (const def of sourceDefs) {
      const { id, ...cols } = def;
      await record_("source", id, await syncRow(tx, sources, id, cols));
    }

    // ---- claims ----------------------------------------------------------
    const claimDefs = [
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
    for (const def of claimDefs) {
      const { id, ...cols } = def;
      await record_("claim", id, await syncRow(tx, claims, id, cols));
    }

    // ---- claim_sources (composite key, no single id) ---------------------
    const claimSourceDefs = [
      { claimId: ids.claimOwned, sourceId: ids.srcAcq, supportType: "SUPPORTS" },
      { claimId: ids.claimOwned, sourceId: ids.srcTrade, supportType: "CORROBORATES" },
      { claimId: ids.claimPortfolio, sourceId: ids.srcPortfolio, supportType: "SUPPORTS" },
    ];
    for (const def of claimSourceDefs) {
      const desired = { supportType: def.supportType };
      const pairId = claimSourceId(def.claimId, def.sourceId);
      const [existing] = await tx
        .select()
        .from(claimSources)
        .where(and(eq(claimSources.claimId, def.claimId), eq(claimSources.sourceId, def.sourceId)));
      if (!existing) {
        await tx.insert(claimSources).values({ ...def });
        audit("claim_source", pairId, null, def);
      } else if (existing.supportType !== desired.supportType) {
        await tx
          .update(claimSources)
          .set(desired)
          .where(
            and(eq(claimSources.claimId, def.claimId), eq(claimSources.sourceId, def.sourceId)),
          );
        audit("claim_source", pairId, existing, { ...existing, ...desired });
      }
    }

    // ---- review ----------------------------------------------------------
    await record_(
      "review",
      ids.review,
      await syncRow(tx, reviews, ids.review, {
        claimId: ids.claimOwned,
        reviewerId: ids.reviewer,
        decision: "APPROVED",
        reasoning: "Tier 1 acquisition announcement plus investor portfolio listing.",
        reviewedAt: new Date("2026-07-18T00:00:00Z"),
      }),
    );

    // ---- audit_events (one per CHANGED object; none on a no-op re-run) ---
    if (auditRows.length > 0) {
      await tx.insert(auditEvents).values(auditRows);
    }
  });

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
