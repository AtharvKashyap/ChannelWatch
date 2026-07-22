import { desc, eq, ilike, inArray, or } from "drizzle-orm";
import {
  ClassificationLabelSchema,
  classificationSummary,
  classificationToBadgeColor,
  confidenceLabelFromScore,
  EDITORIAL_DISCLAIMER,
  UNRESEARCHED_SUMMARY,
  type ChannelLookupPayload,
  type ClassificationLabel,
  type ResearchStatus,
} from "@channelwatch/schemas";
import { deriveClassification } from "@channelwatch/graph";
import type { Database } from "./client.js";
import {
  channels,
  claims,
  claimSources,
  entities,
  entityAliases,
  relationships,
  sources,
} from "./schema.js";
import {
  rowToEntity,
  rowToRelationship,
  type ChannelRow,
  type RelationshipRow,
} from "./mappers.js";

/**
 * Read-side query + assembly helpers for the public API (SPEC §17). Kept apart
 * from the HTTP routes so the data assembly (which is where §17.2 shape and the
 * live-vs-cached classification decision live) is testable and the routes stay
 * thin. Every function is a pure read; no mutation lives here.
 */

/** Endpoint ids of a relationship row (entity id if present, else channel id). */
function edgeEndpoints(r: RelationshipRow): { from: string | null; to: string | null } {
  return {
    from: r.subjectEntityId ?? r.subjectChannelId,
    to: r.objectEntityId ?? r.objectChannelId,
  };
}

/**
 * The connected node ids reachable from a channel over the relationship graph
 * (both directions). Scopes evidence/timeline/ownership to the channel's own
 * ownership sub-graph rather than the whole table.
 */
function connectedNodeIds(startId: string, relRows: RelationshipRow[]): Set<string> {
  const nodes = new Set<string>([startId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of relRows) {
      const { from, to } = edgeEndpoints(r);
      if (from === null || to === null) continue;
      const fromIn = nodes.has(from);
      const toIn = nodes.has(to);
      if (fromIn && !toIn) {
        nodes.add(to);
        grew = true;
      } else if (toIn && !fromIn) {
        nodes.add(from);
        grew = true;
      }
    }
  }
  return nodes;
}

export async function getChannelByYoutubeId(
  db: Database,
  youtubeChannelId: string,
): Promise<ChannelRow | undefined> {
  const [row] = await db
    .select()
    .from(channels)
    .where(eq(channels.youtubeChannelId, youtubeChannelId));
  return row;
}

export async function getChannelById(db: Database, id: string): Promise<ChannelRow | undefined> {
  const [row] = await db.select().from(channels).where(eq(channels.id, id));
  return row;
}

/** Distinct source ids backing any claim whose subject/object is in `nodeIds`. */
async function evidenceSourceIds(db: Database, nodeIds: Set<string>): Promise<string[]> {
  const ids = [...nodeIds];
  if (ids.length === 0) return [];
  const claimRows = await db
    .select()
    .from(claims)
    .where(or(inArray(claims.subjectId, ids), inArray(claims.objectId, ids)));
  const claimIds = claimRows.map((c) => c.id);
  if (claimIds.length === 0) return [];
  const links = await db.select().from(claimSources).where(inArray(claimSources.claimId, claimIds));
  return [...new Set(links.map((l) => l.sourceId))];
}

/**
 * Assemble the §17.2 lookup payload for a known channel.
 *
 * Classification is RECOMPUTED live from the channel's DB relationships via
 * `@channelwatch/graph` (never trusting the cached column blindly). The cached
 * `channels.published_classification` is a FALLBACK ONLY: it is used when the
 * live derivation finds no ownership evidence (graph inputs missing) yet a
 * classification was previously published — e.g. a record whose relationship
 * rows are absent. This keeps the response honest and current while degrading
 * gracefully.
 */
export async function assembleLookup(
  db: Database,
  channel: ChannelRow,
): Promise<ChannelLookupPayload> {
  const relRows = await db.select().from(relationships);
  const entityRows = await db.select().from(entities);
  const mappedRelationships = relRows.map(rowToRelationship);
  const mappedEntities = entityRows.map(rowToEntity);

  const result = deriveClassification({
    channelId: channel.id,
    relationships: mappedRelationships,
    entities: mappedEntities,
    asOf: new Date(),
    lastReviewedAt: channel.lastReviewedAt,
  });

  // Live result is authoritative. Fall back to the cached published label only
  // when the graph produced no ownership evidence but a label was published.
  let label: ClassificationLabel = result.classification;
  let confidence = result.confidence;
  let directOwner = result.directOwner;
  let ultimateParent = result.ultimateParent;
  const noEvidence = result.explanationCodes.includes("NO_OWNERSHIP_EVIDENCE");
  if (noEvidence && channel.publishedClassification) {
    label = ClassificationLabelSchema.parse(channel.publishedClassification);
    confidence = channel.classificationConfidence ? Number(channel.classificationConfidence) : 0;
    directOwner = null;
    ultimateParent = null;
  }

  const nodeIds = connectedNodeIds(channel.id, relRows);
  const sourceIds = await evidenceSourceIds(db, nodeIds);

  const summary = classificationSummary({
    label,
    channelName: channel.displayName,
    directOwnerName: directOwner?.name ?? null,
    ultimateParentName: ultimateParent?.name ?? null,
  });

  return {
    researched: true,
    youtube_channel_id: channel.youtubeChannelId,
    display_name: channel.displayName,
    research_status: (channel.researchStatus ?? "PUBLISHED") as ResearchStatus,
    classification: {
      label,
      confidence,
      confidence_label: confidenceLabelFromScore(confidence),
      summary,
    },
    badge_color: classificationToBadgeColor(label),
    disclaimer: EDITORIAL_DISCLAIMER,
    warnings: result.warnings,
    direct_owner: directOwner,
    ultimate_parent: ultimateParent,
    // Creator involvement is only asserted when explicitly modeled; the pilot
    // records do not carry a creator entity, so this is null rather than a guess.
    creator_status: null,
    last_reviewed_at: channel.lastReviewedAt ? channel.lastReviewedAt.toISOString() : null,
    evidence_count: sourceIds.length,
    disputed: label === "DISPUTED",
  } satisfies ChannelLookupPayload;
}

/** Neutral 200 payload for an unknown / not-yet-researched channel. */
export function unresearchedPayload(youtubeChannelId: string): ChannelLookupPayload {
  return {
    researched: false,
    youtube_channel_id: youtubeChannelId,
    research_status: "UNRESEARCHED",
    summary: UNRESEARCHED_SUMMARY,
    disclaimer: UNRESEARCHED_SUMMARY,
  };
}

/** Ownership chain + participating entities for `GET /channels/:id/ownership`. */
export async function getOwnership(db: Database, channel: ChannelRow) {
  const relRows = await db.select().from(relationships);
  const entityRows = await db.select().from(entities);
  const result = deriveClassification({
    channelId: channel.id,
    relationships: relRows.map(rowToRelationship),
    entities: entityRows.map(rowToEntity),
    asOf: new Date(),
    lastReviewedAt: channel.lastReviewedAt,
  });

  const nodeIds = connectedNodeIds(channel.id, relRows);
  const entityById = new Map(entityRows.map((e) => [e.id, e]));
  const nameOf = (id: string | null): string | null =>
    id === null ? null : (entityById.get(id)?.canonicalName ?? null);

  const subgraph = relRows
    .filter((r) => {
      const { from, to } = edgeEndpoints(r);
      return from !== null && to !== null && (nodeIds.has(from) || nodeIds.has(to));
    })
    .map((r) => {
      const { from, to } = edgeEndpoints(r);
      return {
        id: r.id,
        type: r.relationshipType,
        from: { id: from, name: from === channel.id ? channel.displayName : nameOf(from) },
        to: { id: to, name: to === channel.id ? channel.displayName : nameOf(to) },
        control_level: r.controlLevel,
        ownership_percentage: r.ownershipPercentage ? Number(r.ownershipPercentage) : null,
        confidence: r.confidence ? Number(r.confidence) : null,
        status: r.status,
        effective_from: r.effectiveFrom,
        effective_to: r.effectiveTo,
      };
    });

  return {
    channel: {
      id: channel.id,
      youtube_channel_id: channel.youtubeChannelId,
      display_name: channel.displayName,
    },
    classification: result.classification,
    direct_owner: result.directOwner,
    ultimate_parent: result.ultimateParent,
    chain: result.chain.map((e) => ({
      type: e.type,
      from_entity_id: e.from_entity_id,
      to_entity_id: e.to_entity_id,
      control_level: e.control_level,
      confidence: e.confidence,
    })),
    relationships: subgraph,
  };
}

/** Evidence sources (tier/status/excerpt) for `GET /channels/:id/evidence`. */
export async function getEvidence(db: Database, channel: ChannelRow) {
  const relRows = await db.select().from(relationships);
  const nodeIds = connectedNodeIds(channel.id, relRows);
  const ids = [...nodeIds];

  const claimRows =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(claims)
          .where(or(inArray(claims.subjectId, ids), inArray(claims.objectId, ids)));
  const claimIds = claimRows.map((c) => c.id);
  const links =
    claimIds.length === 0
      ? []
      : await db.select().from(claimSources).where(inArray(claimSources.claimId, claimIds));

  const sourceIds = [...new Set(links.map((l) => l.sourceId))];
  const sourceRows =
    sourceIds.length === 0
      ? []
      : await db.select().from(sources).where(inArray(sources.id, sourceIds));

  // Excerpt: the first quoted excerpt captured for the source across its links.
  const excerptBySource = new Map<string, string | null>();
  for (const l of links) {
    if (!excerptBySource.has(l.sourceId)) excerptBySource.set(l.sourceId, l.quotedExcerpt ?? null);
  }

  const evidence = sourceRows
    .map((s) => ({
      id: s.id,
      url: s.url,
      title: s.title,
      publisher: s.publisher,
      tier: s.sourceTier,
      source_type: s.sourceType,
      status: s.status,
      published_at: s.publishedAt ? s.publishedAt.toISOString() : null,
      archive_url: s.archiveUrl,
      excerpt: excerptBySource.get(s.id) ?? null,
    }))
    // Deterministic ordering: best tier first, then title.
    .sort(
      (a, b) => (a.tier ?? 99) - (b.tier ?? 99) || (a.title ?? "").localeCompare(b.title ?? ""),
    );

  return { channel_id: channel.id, evidence_count: evidence.length, evidence };
}

/** A single dated event on a channel's ownership timeline. */
export interface TimelineEvent {
  date: string | null;
  kind: "RELATIONSHIP" | "CLAIM";
  type: string;
  subject: string | null;
  object: string | null;
  status: string | null;
}

/** Ownership timeline (relationships + claims by effective date) for `/timeline`. */
export async function getTimeline(db: Database, channel: ChannelRow) {
  const relRows = await db.select().from(relationships);
  const nodeIds = connectedNodeIds(channel.id, relRows);
  const ids = [...nodeIds];
  const entityRows = await db.select().from(entities);
  const entityById = new Map(entityRows.map((e) => [e.id, e]));
  const nameOf = (id: string | null): string | null =>
    id === null
      ? null
      : id === channel.id
        ? channel.displayName
        : (entityById.get(id)?.canonicalName ?? null);

  const claimRows =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(claims)
          .where(or(inArray(claims.subjectId, ids), inArray(claims.objectId, ids)));

  const events: TimelineEvent[] = [];
  for (const r of relRows) {
    const { from, to } = edgeEndpoints(r);
    if (from === null || to === null) continue;
    if (!nodeIds.has(from) && !nodeIds.has(to)) continue;
    events.push({
      date: r.effectiveFrom,
      kind: "RELATIONSHIP",
      type: r.relationshipType,
      subject: nameOf(from),
      object: nameOf(to),
      status: r.status,
    });
  }
  for (const cRow of claimRows) {
    events.push({
      date: cRow.effectiveDate,
      kind: "CLAIM",
      type: cRow.predicate,
      subject: nameOf(cRow.subjectId),
      object: nameOf(cRow.objectId ?? null),
      status: cRow.claimStatus,
    });
  }

  // Oldest first; undated events sort last (null dates have no known position).
  events.sort((a, b) => {
    if (a.date === null && b.date === null) return 0;
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return a.date.localeCompare(b.date);
  });

  return { channel_id: channel.id, events };
}

/** Entity + aliases + relationships it participates in, for `GET /entities/:id`. */
export async function getEntity(db: Database, id: string) {
  const [entity] = await db.select().from(entities).where(eq(entities.id, id));
  if (!entity) return undefined;
  const aliases = await db.select().from(entityAliases).where(eq(entityAliases.entityId, id));
  const relRows = await db
    .select()
    .from(relationships)
    .where(or(eq(relationships.subjectEntityId, id), eq(relationships.objectEntityId, id)));

  return {
    id: entity.id,
    entity_type: entity.entityType,
    canonical_name: entity.canonicalName,
    legal_name: entity.legalName,
    jurisdiction: entity.jurisdiction,
    website: entity.website,
    aliases: aliases.map((a) => ({ alias: a.alias, alias_type: a.aliasType })),
    relationships: relRows.map((r) => {
      const { from, to } = edgeEndpoints(r);
      return {
        id: r.id,
        type: r.relationshipType,
        from_id: from,
        to_id: to,
        control_level: r.controlLevel,
        status: r.status,
      };
    }),
  };
}

/** Channel search over display_name + handle (ILIKE), capped at 20 rows. */
export async function searchChannels(db: Database, query: string) {
  const term = `%${query}%`;
  const rows = await db
    .select()
    .from(channels)
    .where(or(ilike(channels.displayName, term), ilike(channels.handle, term)))
    .orderBy(desc(channels.lastReviewedAt))
    .limit(20);
  return rows.map((c) => ({
    youtube_channel_id: c.youtubeChannelId,
    display_name: c.displayName,
    handle: c.handle,
    classification: c.publishedClassification,
    research_status: c.researchStatus,
  }));
}
