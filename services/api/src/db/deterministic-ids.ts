import { createHash } from "node:crypto";

/**
 * Deterministic UUID derivation shared by every write path (the seed and the
 * research-record importer). This is the single source of truth for a row's
 * primary key: an id is a pure function of the row's STABLE LOGICAL IDENTITY
 * (its natural key), never of an arbitrary label or insertion order.
 *
 * The idempotency principle depends on this being centralized: the same logical
 * record must converge to the same rows no matter which path wrote it. If seed
 * and importer derived ids from different natural-key strings, the same logical
 * relationship would land under two different ids and duplicate. Both paths MUST
 * route through the semantic builders below.
 *
 * Natural keys (per SPEC data model):
 *   - channel:      youtube_channel_id
 *   - entity:       canonical_name
 *   - entity_alias: entity_id + alias
 *   - source:       url
 *   - relationship: subject id + type + object id
 *   - claim:        subject id + predicate + object id
 *   - claim_source: claim id + source id
 *   - reviewer:     email
 *   - review:       claim id
 *   - audit:        action + object id
 */

// Fixed namespace UUID for deterministic v5 ids across all write paths.
export const SEED_NAMESPACE = "6b1b3f2e-3c9a-5c7d-8e10-0f1a2b3c4d5e";

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

/** RFC 4122 v5 UUID (SHA-1) — deterministic id for the natural key `${kind}:${key}`. */
export function deterministicId(kind: string, key: string): string {
  const hash = createHash("sha1")
    .update(Buffer.concat([uuidToBytes(SEED_NAMESPACE), Buffer.from(`${kind}:${key}`)]))
    .digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6]! & 0x0f) | 0x50; // version 5
  b[8] = (b[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = b.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ---- Semantic natural-key builders ---------------------------------------
// Every write path derives ids ONLY through these so identical logical records
// converge on identical ids regardless of writer.

export const channelId = (youtubeChannelId: string): string =>
  deterministicId("channel", youtubeChannelId);

export const entityId = (canonicalName: string): string => deterministicId("entity", canonicalName);

export const entityAliasId = (entityRowId: string, alias: string): string =>
  deterministicId("entity_alias", `${entityRowId}:${alias}`);

export const sourceId = (url: string): string => deterministicId("source", url);

export const relationshipId = (subjectId: string, type: string, objectId: string): string =>
  deterministicId("relationship", `${subjectId}:${type}:${objectId}`);

export const claimId = (subjectId: string, predicate: string, objectId: string): string =>
  deterministicId("claim", `${subjectId}:${predicate}:${objectId}`);

export const claimSourceId = (claimRowId: string, sourceRowId: string): string =>
  deterministicId("claim_source", `${claimRowId}:${sourceRowId}`);

export const reviewerId = (email: string): string => deterministicId("reviewer", email);

export const reviewId = (claimRowId: string): string => deterministicId("review", claimRowId);

export const auditId = (action: string, objectId: string): string =>
  deterministicId("audit", `${action}:${objectId}`);
