import type { InferSelectModel } from "drizzle-orm";
import {
  Entity,
  Relationship,
  Source,
  Claim,
  type ControlLevel,
  type RelationshipStatus,
} from "@channelwatch/schemas";
import { channels, entities, relationships, sources, claims } from "./schema.js";

/**
 * Pure row↔domain mappers. Database rows use §16 column names and the driver's
 * representations (numeric → string, timestamptz → Date); these functions
 * translate to the `@channelwatch/schemas` domain shapes and validate through
 * the Zod schemas so every value crossing the boundary is checked. No I/O here.
 *
 * The relationships table (§16) is subject/object with separate entity/channel
 * columns; the graph's `Relationship` is a single directed edge keyed by
 * `from_entity_id`/`to_entity_id`. A channel participates in the graph under its
 * own UUID, so `from`/`to` collapse the (entity_id ?? channel_id) pair.
 */

export type ChannelRow = InferSelectModel<typeof channels>;
export type EntityRow = InferSelectModel<typeof entities>;
export type RelationshipRow = InferSelectModel<typeof relationships>;
export type SourceRow = InferSelectModel<typeof sources>;
export type ClaimRow = InferSelectModel<typeof claims>;

function numericToNumber(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function dateToIso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

/** entities row → graph/domain `Entity` (id, name, type). */
export function rowToEntity(row: EntityRow): Entity {
  return Entity.parse({
    id: row.id,
    name: row.canonicalName,
    type: row.entityType,
  });
}

/**
 * relationships row → graph `Relationship`. Endpoints collapse the subject/object
 * entity-or-channel columns; a null percentage/confidence is normalised, and the
 * enum-valued `control_level`/`status` fall back to the schema defaults when the
 * column is null (UNKNOWN / ACTIVE).
 */
export function rowToRelationship(row: RelationshipRow): Relationship {
  const from = row.subjectEntityId ?? row.subjectChannelId;
  const to = row.objectEntityId ?? row.objectChannelId;
  if (from === null || to === null) {
    throw new Error(
      `relationship ${row.id} has no resolvable ${from === null ? "subject" : "object"} endpoint`,
    );
  }
  return Relationship.parse({
    type: row.relationshipType,
    from_entity_id: from,
    to_entity_id: to,
    effective_from: row.effectiveFrom,
    effective_to: row.effectiveTo,
    ownership_percentage: numericToNumber(row.ownershipPercentage),
    control_level: (row.controlLevel ?? "UNKNOWN") as ControlLevel,
    confidence: numericToNumber(row.confidence) ?? 0,
    source_ids: [],
    status: (row.status ?? "ACTIVE") as RelationshipStatus,
  });
}

/** sources row → domain `Source`. */
export function rowToSource(row: SourceRow): Source {
  return Source.parse({
    id: row.id,
    url: row.url,
    tier: row.sourceTier,
    status: row.status,
    archive_url: row.archiveUrl,
    content_hash: row.contentHash,
    retrieved_at: dateToIso(row.retrievedAt),
    title: row.title,
  });
}

/** claims row → domain `Claim` (§16 subject/predicate/object shape). */
export function rowToClaim(row: ClaimRow): Claim {
  return Claim.parse({
    id: row.id,
    subject_type: row.subjectType,
    subject_id: row.subjectId,
    predicate: row.predicate,
    object_type: row.objectType,
    object_id: row.objectId,
    literal_value: row.literalValue,
    confidence: numericToNumber(row.confidence),
    claim_status: row.claimStatus,
    effective_date: row.effectiveDate,
    expiration_date: row.expirationDate,
    review_notes: row.reviewNotes,
    created_at: dateToIso(row.createdAt),
    updated_at: dateToIso(row.updatedAt),
  });
}
