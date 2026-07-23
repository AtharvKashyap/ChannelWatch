import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { and, eq } from "drizzle-orm";
import {
  ResearchRecord,
  type Entity as GraphEntity,
  type Relationship as GraphRelationship,
  PUBLICATION_THRESHOLD,
} from "@channelwatch/schemas";
import { canPublishPeLabel, scoreClaimConfidence, type PeLabelSource } from "@channelwatch/scoring";
import { deriveClassification } from "@channelwatch/graph";
import { getDb, closeDb, type Database } from "../src/db/client.js";
import { deriveForChannel } from "../src/db/queries.js";
import { syncRow } from "../src/db/sync-row.js";
import {
  channelId as channelIdFor,
  claimId as claimIdFor,
  claimSourceId,
  entityAliasId,
  entityId as entityIdFor,
  relationshipId as relationshipIdFor,
  reviewerId,
  sourceId as sourceIdFor,
} from "../src/db/deterministic-ids.js";
import {
  auditEvents,
  channels,
  claims,
  claimSources,
  entities,
  entityAliases,
  relationships,
  reviewers,
  sources,
} from "../src/db/schema.js";

/**
 * Research-record importer: the seed-phase publication path. Reads one YAML file
 * per channel from `data/research/`, validates it against the `ResearchRecord`
 * schema, enforces the trust-critical evidence rules, computes the ownership
 * classification with `@channelwatch/graph`, and upserts the result.
 *
 * Trust rules enforced here (beyond the schema's structural refinements):
 *   - PE-implying relationships (type PORTFOLIO_COMPANY_OF, or an endpoint that
 *     is a PRIVATE_EQUITY_FIRM) must satisfy `canPublishPeLabel` (§14.3) over
 *     their supporting sources — publisher strings are normalized inside
 *     `canPublishPeLabel`. Import fails loudly otherwise.
 *   - Classification is COMPUTED, never read from the YAML.
 *
 * Idempotency & audit: every row uses a deterministic UUID derived from its
 * natural key, and writes are change-detected — a row is only INSERTed/UPDATEd
 * (and only then does it emit an `audit_events` row) when its content actually
 * differs from what is stored. Re-running an unchanged file is a true no-op:
 * zero writes, zero new audit rows.
 *
 * Fixtures: records with `fixture: true` are skipped unless `--include-fixtures`
 * is passed, keeping the fictional §35 example out of real data.
 */

// Deterministic ids come from the shared `src/db/deterministic-ids.ts` builders
// — the exact same natural-key scheme scripts/seed.ts uses — so the two write
// paths converge on identical ids for the same logical record and neither can
// duplicate a row the other wrote.

const CHANNEL_REF = "channel";
const IMPORT_ACTION = "IMPORT_RESEARCH_RECORD";

export interface ImportSummary {
  file: string;
  channelId: string;
  classification: string;
  classificationConfidence: number;
  /** Rows inserted or updated (i.e. rows that produced an audit event). */
  changed: number;
  auditWritten: number;
}

/**
 * Enforce the §14.3 PE-label rule over the record's PE-implying relationships.
 * Pure (no I/O) so it is unit-testable without a database. Throws with a clear
 * message naming the offending relationship when a PE label lacks qualifying
 * evidence.
 */
export function assertPePublishable(record: ResearchRecord): void {
  const entityTypeBySlug = new Map(record.entities.map((e) => [e.slug, e.entity_type]));

  record.relationships.forEach((rel, i) => {
    const subjectIsPe = entityTypeBySlug.get(rel.subject) === "PRIVATE_EQUITY_FIRM";
    const objectIsPe = entityTypeBySlug.get(rel.object) === "PRIVATE_EQUITY_FIRM";
    const isPeImplying = rel.type === "PORTFOLIO_COMPANY_OF" || subjectIsPe || objectIsPe;
    if (!isPeImplying) return;

    // Pass the publisher verbatim (null when absent). NEVER fall back to the
    // title/url: those are not publisher identities, and substituting them would
    // let two publisher-less Tier 2 sources with different titles count as two
    // independent publishers and wrongly satisfy the §14.3 rule.
    const supporting: PeLabelSource[] = record.sources
      .filter((s) => s.supports.some((sup) => "relationship" in sup && sup.relationship === i))
      .map((s) => ({ tier: s.tier, publisher: s.publisher ?? null }));

    if (!canPublishPeLabel(supporting)) {
      throw new Error(
        `PE-implying relationship ${i} (${rel.subject} ${rel.type} ${rel.object}) cannot be ` +
          `published: its supporting sources do not satisfy the §14.3 rule ` +
          `(need one Tier 1 source, or two Tier 2 sources from independent publishers).`,
      );
    }
  });
}

/** Parse + fully validate a raw object into a ResearchRecord (schema + PE rule). */
export function validateResearchRecord(raw: unknown): ResearchRecord {
  const record = ResearchRecord.parse(raw);
  assertPePublishable(record);
  return record;
}

export async function importRecord(
  db: Database,
  raw: unknown,
  file: string,
): Promise<ImportSummary> {
  const record = validateResearchRecord(raw);

  // ---- id resolution -----------------------------------------------------
  const channelId = channelIdFor(record.channel.youtube_channel_id);
  const entityIdBySlug = new Map<string, string>();
  for (const entity of record.entities) {
    entityIdBySlug.set(entity.slug, entityIdFor(entity.canonical_name));
  }
  const resolveRef = (ref: string): string =>
    ref === CHANNEL_REF ? channelId : entityIdBySlug.get(ref)!;

  const sourceIdByRef = new Map<string, string>();
  for (const source of record.sources) {
    sourceIdByRef.set(source.ref, sourceIdFor(source.url));
  }

  const relationshipIds = record.relationships.map((rel) =>
    relationshipIdFor(resolveRef(rel.subject), rel.type, resolveRef(rel.object)),
  );
  const claimList = record.claims ?? [];
  const claimIds = claimList.map((claim) =>
    claimIdFor(resolveRef(claim.subject), claim.predicate, resolveRef(claim.object)),
  );

  // ---- compute a RECORD-LOCAL classification (never from YAML) -----------
  // This is INFORMATIONAL ONLY: it is reported in the ImportSummary/log as "what
  // this record says about its own channel in isolation". It is NOT written to
  // the cached `channels.published_classification` column — that column is owned
  // solely by the whole-graph recompute pass (`recomputeClassifications`), which
  // derives every channel over its full connected sub-graph (the view the API
  // serves). Having a single, whole-graph writer is what keeps re-imports a true
  // no-op: a record-local write here would disagree with the recompute wherever
  // records share entities, and the two would overwrite each other every run.
  const graphEntities: GraphEntity[] = record.entities.map((e) => ({
    id: entityIdBySlug.get(e.slug)!,
    name: e.canonical_name,
    type: e.entity_type,
  }));
  const graphRelationships: GraphRelationship[] = record.relationships.map((rel) => ({
    type: rel.type,
    from_entity_id: resolveRef(rel.subject),
    to_entity_id: resolveRef(rel.object),
    effective_from: rel.effective_from ?? null,
    effective_to: rel.effective_to ?? null,
    ownership_percentage: rel.ownership_percentage ?? null,
    control_level: rel.control_level ?? "UNKNOWN",
    confidence: rel.confidence,
    source_ids: [],
    status: rel.status,
  }));
  const classification = deriveClassification({
    channelId,
    relationships: graphRelationships,
    entities: graphEntities,
    asOf: new Date(),
    lastReviewedAt: record.review.last_reviewed_at,
  });

  // ---- audit collection --------------------------------------------------
  const actorId = reviewerId(record.review.researched_by);
  const auditRows: (typeof auditEvents.$inferInsert)[] = [];
  const audit = (objectType: string, objectId: string, before: unknown, after: unknown): void => {
    auditRows.push({
      actorId,
      action: IMPORT_ACTION,
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
  ): Promise<number> => {
    if (r.result === "unchanged") return 0;
    audit(objectType, objectId, r.before, r.after);
    return 1;
  };

  let changed = 0;

  // All of a file's writes run in ONE transaction: a mid-write failure rolls
  // back the whole record rather than leaving a channel half-imported. Reads
  // and writes inside use the transaction handle `tx`.
  await db.transaction(async (tx) => {
    // ---- reviewer (audit actor provenance) -------------------------------
    changed += await record_(
      "reviewer",
      actorId,
      await syncRow(tx, reviewers, actorId, {
        email: record.review.researched_by,
        displayName: record.review.researched_by,
        role: "RESEARCHER",
      }),
    );

    // ---- entities ----------------------------------------------------------
    for (const entity of record.entities) {
      const id = entityIdBySlug.get(entity.slug)!;
      changed += await record_(
        "entity",
        id,
        await syncRow(tx, entities, id, {
          entityType: entity.entity_type,
          canonicalName: entity.canonical_name,
          legalName: entity.legal_name ?? null,
          jurisdiction: entity.jurisdiction ?? null,
          website: entity.website ?? null,
        }),
      );
      // aliases (natural key: entity_id + alias)
      for (const alias of entity.aliases ?? []) {
        const aliasId = entityAliasId(id, alias);
        changed += await record_(
          "entity_alias",
          aliasId,
          await syncRow(tx, entityAliases, aliasId, {
            entityId: id,
            alias,
            aliasType: "ALSO_KNOWN_AS",
          }),
        );
      }
    }

    // ---- sources -----------------------------------------------------------
    for (const source of record.sources) {
      const id = sourceIdByRef.get(source.ref)!;
      changed += await record_(
        "source",
        id,
        await syncRow(tx, sources, id, {
          url: source.url,
          title: source.title,
          publisher: source.publisher ?? null,
          publishedAt: source.published_at ? new Date(source.published_at) : null,
          sourceTier: source.tier,
          sourceType: source.source_type,
          archiveUrl: source.archive_url ?? null,
          status: "ACTIVE",
        }),
      );
    }

    // ---- channel -----------------------------------------------------------
    // The cached classification columns (`published_classification`,
    // `classification_confidence`) are DELIBERATELY not written here — they are
    // owned by the whole-graph `recomputeClassifications` pass, the single writer
    // (see the classification comment above). syncRow only compares/writes the
    // columns in `desired`, so leaving them out means this write never fights the
    // recompute, and a re-import over settled data is a true no-op.
    changed += await record_(
      "channel",
      channelId,
      await syncRow(tx, channels, channelId, {
        youtubeChannelId: record.channel.youtube_channel_id,
        handle: record.channel.handle ?? null,
        displayName: record.channel.display_name,
        researchStatus: "PUBLISHED",
        lastReviewedAt: new Date(record.review.last_reviewed_at),
      }),
    );

    // ---- relationships -----------------------------------------------------
    for (let i = 0; i < record.relationships.length; i++) {
      const rel = record.relationships[i]!;
      const id = relationshipIds[i]!;
      const subjectId = resolveRef(rel.subject);
      const objectId = resolveRef(rel.object);
      const subjectIsChannel = rel.subject === CHANNEL_REF;
      const objectIsChannel = rel.object === CHANNEL_REF;
      changed += await record_(
        "relationship",
        id,
        await syncRow(tx, relationships, id, {
          subjectEntityId: subjectIsChannel ? null : subjectId,
          subjectChannelId: subjectIsChannel ? subjectId : null,
          objectEntityId: objectIsChannel ? null : objectId,
          objectChannelId: objectIsChannel ? objectId : null,
          relationshipType: rel.type,
          ownershipPercentage:
            rel.ownership_percentage != null ? String(rel.ownership_percentage) : null,
          controlLevel: rel.control_level ?? "UNKNOWN",
          effectiveFrom: rel.effective_from ?? null,
          effectiveTo: rel.effective_to ?? null,
          confidence: String(rel.confidence),
          status: rel.status,
        }),
      );
    }

    // ---- claims + claim_sources --------------------------------------------
    for (let i = 0; i < claimList.length; i++) {
      const claim = claimList[i]!;
      const id = claimIds[i]!;
      const confidence = claim.confidence_factors
        ? scoreClaimConfidence(claim.confidence_factors)
        : null;
      const claimStatus =
        confidence !== null && confidence < PUBLICATION_THRESHOLD ? "UNDER_REVIEW" : "PUBLISHED";
      const subjectIsChannel = claim.subject === CHANNEL_REF;
      const objectIsChannel = claim.object === CHANNEL_REF;
      changed += await record_(
        "claim",
        id,
        await syncRow(tx, claims, id, {
          subjectType: subjectIsChannel ? "CHANNEL" : "ENTITY",
          subjectId: resolveRef(claim.subject),
          predicate: claim.predicate,
          objectType: objectIsChannel ? "CHANNEL" : "ENTITY",
          objectId: resolveRef(claim.object),
          confidence: confidence !== null ? String(confidence) : null,
          claimStatus,
          effectiveDate: claim.effective_date ?? null,
        }),
      );
    }

    // claim_sources: link each source that supports a claim index.
    for (const source of record.sources) {
      const sourceId = sourceIdByRef.get(source.ref)!;
      for (const support of source.supports) {
        if (!("claim" in support)) continue;
        const claimId = claimIds[support.claim];
        if (!claimId) continue;
        const [existing] = await tx
          .select()
          .from(claimSources)
          .where(and(eq(claimSources.claimId, claimId), eq(claimSources.sourceId, sourceId)));
        const desired = { supportType: "SUPPORTS", quotedExcerpt: source.excerpt };
        const pairId = claimSourceId(claimId, sourceId);
        if (!existing) {
          await tx.insert(claimSources).values({ claimId, sourceId, ...desired });
          audit("claim_source", pairId, null, { claimId, sourceId, ...desired });
          changed += 1;
        } else if (
          existing.supportType !== desired.supportType ||
          existing.quotedExcerpt !== desired.quotedExcerpt
        ) {
          await tx
            .update(claimSources)
            .set(desired)
            .where(and(eq(claimSources.claimId, claimId), eq(claimSources.sourceId, sourceId)));
          audit("claim_source", pairId, existing, { ...existing, ...desired });
          changed += 1;
        }
      }
    }

    if (auditRows.length > 0) {
      await tx.insert(auditEvents).values(auditRows);
    }
  });

  return {
    file,
    channelId,
    classification: classification.classification,
    classificationConfidence: classification.confidence,
    changed,
    auditWritten: auditRows.length,
  };
}

function researchDir(): string {
  // scripts/ -> services/api -> repo root -> data/research
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../../data/research");
}

export async function importAll(
  db: Database,
  options: { includeFixtures: boolean; dir?: string },
): Promise<ImportSummary[]> {
  const dir = options.dir ?? researchDir();
  const files = readdirSync(dir)
    .filter((f) => (f.endsWith(".yaml") || f.endsWith(".yml")) && !f.startsWith("_"))
    .sort();

  const summaries: ImportSummary[] = [];
  for (const file of files) {
    const raw = parseYaml(readFileSync(join(dir, file), "utf8")) as { fixture?: boolean } | null;
    if (raw && raw.fixture && !options.includeFixtures) {
      console.log(`skip ${file} (fixture; pass --include-fixtures to import)`);
      continue;
    }
    summaries.push(await importRecord(db, raw, file));
  }

  // Settle the cached labels over the WHOLE graph once every record is imported.
  // This is the single writer of `published_classification`, so importing the
  // whole directory leaves the cache fully settled — and re-importing is a true
  // no-op (no writer disagrees with another). Callers that import via `importAll`
  // (the CLI and the tests) therefore always get consistent, idempotent state.
  const recomputed = await recomputeClassifications(db);
  const rewritten = recomputed.filter((r) => r.changed);
  for (const r of rewritten) {
    console.log(
      `recomputed ${r.youtubeChannelId}: ${r.classification} (${r.classificationConfidence}) ` +
        `[whole-graph]`,
    );
  }
  console.log(
    `whole-graph recompute: ${rewritten.length} of ${recomputed.length} cached label(s) settled`,
  );

  return summaries;
}

const RECOMPUTE_ACTION = "RECOMPUTE_CLASSIFICATION";

export interface RecomputeSummary {
  channelId: string;
  youtubeChannelId: string;
  classification: string;
  classificationConfidence: number;
  /** True when the cached column was actually rewritten (produced an audit row). */
  changed: boolean;
}

/**
 * Post-import WHOLE-GRAPH recompute of the cached `channels.published_classification`
 * column (flagged M3 wart). `importRecord` computes each channel's label from ONLY
 * that record's own relationships, but the public API serves a whole-graph
 * recompute over the channel's connected sub-graph (which can span entities shared
 * across records). This step re-derives every channel's classification the exact
 * same way the API does — via `deriveForChannel` — and writes the result back so
 * the cached labels match what is served.
 *
 * It mirrors the API assembler's degraded-fallback rule: the whole-graph live
 * derivation is authoritative UNLESS it is degraded (no ownership evidence, or an
 * OWNERSHIP_UNCLEAR caused by a sub-graph row that had to be skipped), in which
 * case the existing per-record cached label is left in place as the honest
 * fallback rather than being overwritten with a weaker one. Change-detected: a
 * channel whose label/confidence is unchanged is not rewritten and emits no audit.
 */
export async function recomputeClassifications(db: Database): Promise<RecomputeSummary[]> {
  const channelRows = await db.select().from(channels);
  const summaries: RecomputeSummary[] = [];
  for (const channel of channelRows) {
    const { result, skipped } = await deriveForChannel(db, channel);
    const noEvidence = result.explanationCodes.includes("NO_OWNERSHIP_EVIDENCE");
    const degraded = noEvidence || (skipped > 0 && result.classification === "OWNERSHIP_UNCLEAR");
    if (degraded) {
      summaries.push({
        channelId: channel.id,
        youtubeChannelId: channel.youtubeChannelId,
        classification: channel.publishedClassification ?? result.classification,
        classificationConfidence: channel.classificationConfidence
          ? Number(channel.classificationConfidence)
          : result.confidence,
        changed: false,
      });
      continue;
    }

    const synced = await syncRow(db, channels, channel.id, {
      publishedClassification: result.classification,
      classificationConfidence: String(result.confidence),
    });
    if (synced.result !== "unchanged") {
      await db.insert(auditEvents).values({
        actorId: null,
        action: RECOMPUTE_ACTION,
        objectType: "channel",
        objectId: channel.id,
        beforeState: (synced.before ?? null) as object | null,
        afterState: (synced.after ?? null) as object | null,
      });
    }
    summaries.push({
      channelId: channel.id,
      youtubeChannelId: channel.youtubeChannelId,
      classification: result.classification,
      classificationConfidence: result.confidence,
      changed: synced.result !== "unchanged",
    });
  }
  return summaries;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set (see .env.example).");
  }
  const includeFixtures = process.argv.includes("--include-fixtures");
  const summaries = await importAll(getDb(), { includeFixtures });
  for (const s of summaries) {
    console.log(
      `imported ${s.file}: ${s.classification} (${s.classificationConfidence}) — ` +
        `${s.changed} row(s) changed, ${s.auditWritten} audit event(s)`,
    );
  }
  if (summaries.length === 0) console.log("no research records imported");
  // `importAll` already ran the whole-graph recompute that settles the cached
  // labels (it is the single writer of `published_classification`).
  await closeDb();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
