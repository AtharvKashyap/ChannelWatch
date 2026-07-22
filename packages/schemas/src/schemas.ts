import { z } from "zod";
import {
  EntityTypeSchema,
  RelationshipTypeSchema,
  EvidenceStatusSchema,
  ClaimStatusSchema,
  ConfidenceLabelSchema,
  ClassificationLabelSchema,
  ControlLevelSchema,
  CreatorStatusSchema,
  SourceTierSchema,
  RelationshipStatusSchema,
} from "./enums.js";

/**
 * An ISO 8601 date or date-time string. Used for the DATE / TIMESTAMPTZ columns
 * that Drizzle rows surface as strings (see `services/api` mappers). Kept as a
 * lenient string rather than a coerced Date so schema objects round-trip 1:1
 * with database rows.
 */
const isoDateString = z.string().min(1);

/**
 * Zod schemas for CHANNELWATCH data structures. Shapes track docs/SPEC.md
 * (notably §15.3 relationship properties and the §17.2 example response).
 */

/**
 * A canonical YouTube channel ID: the literal "UC" followed by 22 characters
 * from the base64url alphabet. Rejects @handles, custom URLs, and names.
 */
export const YoutubeChannelId = z
  .string()
  .regex(/^UC[A-Za-z0-9_-]{22}$/, "must be a canonical YouTube channel ID (UC + 22 chars)");
export type YoutubeChannelId = z.infer<typeof YoutubeChannelId>;

/** A node in the ownership graph (§15.1). */
export const Entity = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: EntityTypeSchema,
});
export type Entity = z.infer<typeof Entity>;

/** A tracked YouTube channel. */
export const Channel = z.object({
  youtube_channel_id: YoutubeChannelId,
  display_name: z.string().min(1),
});
export type Channel = z.infer<typeof Channel>;

/** A directed edge in the ownership graph (§15.2 type, §15.3 properties). */
export const Relationship = z.object({
  type: RelationshipTypeSchema,
  from_entity_id: z.string().min(1),
  to_entity_id: z.string().min(1),
  effective_from: z.string().nullable().optional(),
  effective_to: z.string().nullable().optional(),
  ownership_percentage: z.number().min(0).max(100).nullable().optional(),
  control_level: ControlLevelSchema,
  confidence: z.number().min(0).max(1),
  source_ids: z.array(z.string()),
  // Lifecycle status of the published edge, 1:1 with the `relationships.status`
  // column (SPEC §16). The ownership classifier (`packages/graph`) treats an
  // edge as ACTIVE iff `status === "ACTIVE"` (and its time window is current).
  // Defaults to ACTIVE so existing callers that omit it keep the pre-status
  // "published edge is live" semantics.
  status: RelationshipStatusSchema.default("ACTIVE"),
  notes: z.string().optional(),
});
export type Relationship = z.infer<typeof Relationship>;

/** An evidence source backing one or more claims (§7.1, §8.2). */
export const Source = z.object({
  id: z.string().min(1),
  url: z.url(),
  // `tier` (source_tier) and `status` are nullable TEXT/INTEGER columns (SPEC
  // §16): a source can exist before it is graded/triaged. A null column is a
  // legitimate "not yet assigned" state, so these tolerate null rather than
  // making the row unmappable. A NON-null value is still validated against the
  // enum/tier taxonomy.
  tier: SourceTierSchema.nullable().optional(),
  status: EvidenceStatusSchema.nullable().optional(),
  archive_url: z.url().nullable().optional(),
  content_hash: z.string().nullable().optional(),
  retrieved_at: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
});
export type Source = z.infer<typeof Source>;

/**
 * A discrete reviewed ownership claim (§7, §8.3). Shape is 1:1 with the
 * `claims` table (SPEC §16): a subject/predicate/object triple plus optional
 * literal value, its review lifecycle (`claim_status`), effective window, and
 * confidence. Evidence links live in the `claim_sources` join table, not here.
 * `subject_type`/`object_type`/`predicate` are free TEXT in the DDL (no closed
 * enum in the SPEC), so they are validated only as non-empty strings.
 */
export const Claim = z.object({
  id: z.string().min(1),
  subject_type: z.string().min(1),
  subject_id: z.string().min(1),
  predicate: z.string().min(1),
  object_type: z.string().nullable().optional(),
  object_id: z.string().nullable().optional(),
  // JSONB literal payload for claims whose object is a scalar rather than an
  // entity/channel reference. Any JSON value (or null).
  literal_value: z.unknown().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  // `claim_status` is a nullable TEXT column (SPEC §16); a claim row can exist
  // before its review lifecycle state is set. Tolerate null (unset) while still
  // validating any non-null value against the enum.
  claim_status: ClaimStatusSchema.nullable().optional(),
  effective_date: isoDateString.nullable().optional(),
  expiration_date: isoDateString.nullable().optional(),
  review_notes: z.string().nullable().optional(),
  created_at: isoDateString.nullable().optional(),
  updated_at: isoDateString.nullable().optional(),
});
export type Claim = z.infer<typeof Claim>;

/** Owner/parent reference embedded in the lookup response. */
export const EntityRef = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: EntityTypeSchema,
});
export type EntityRef = z.infer<typeof EntityRef>;

/** Public channel-lookup API response, shape per SPEC §17.2. */
export const ChannelLookupResponse = z.object({
  // §17.2 uses a placeholder ID ("UC123456789") that is not a canonical 24-char
  // channel ID, so this field is a plain string rather than YoutubeChannelId.
  youtube_channel_id: z.string(),
  display_name: z.string(),
  classification: z.object({
    label: ClassificationLabelSchema,
    confidence: z.number().min(0).max(1),
    confidence_label: ConfidenceLabelSchema,
    summary: z.string(),
  }),
  direct_owner: EntityRef.nullable(),
  ultimate_parent: EntityRef.nullable(),
  creator_status: z
    .object({
      status: CreatorStatusSchema,
      ownership_stake: z.string(),
    })
    .nullable(),
  last_reviewed_at: z.string().nullable(),
  evidence_count: z.number().int().nonnegative(),
  disputed: z.boolean(),
});
export type ChannelLookupResponse = z.infer<typeof ChannelLookupResponse>;
