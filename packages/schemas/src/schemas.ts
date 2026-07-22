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
  ResearchStatusSchema,
  BadgeColorSchema,
  ExplanationCodeSchema,
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

/**
 * The public lookup PAYLOAD actually returned by `GET /channels/youtube/:id` for
 * a researched channel. It extends the pristine §17.2 `ChannelLookupResponse`
 * with fields the extension/panel need but that §17.2 does not itemize:
 *   - `research_status` — the channel's §20.1 queue state (PUBLISHED here);
 *   - `badge_color`     — the §9.2 badge color the label maps to (PE_BACKED →
 *     ORANGE; RED is reserved for DISPUTED — never PE);
 *   - `disclaimer`      — the standing "no editorial conclusion" line (§23.1);
 *   - `warnings`        — machine-readable §9.4 warning codes (e.g. ownership
 *     changed recently), empty when none.
 * `ChannelLookupResponse` is left untouched so the §17.2 canonical example
 * fixture keeps validating against the exact spec shape.
 */
export const ResearchedChannelLookup = ChannelLookupResponse.extend({
  researched: z.literal(true),
  research_status: ResearchStatusSchema,
  badge_color: BadgeColorSchema,
  disclaimer: z.string(),
  warnings: z.array(ExplanationCodeSchema),
});
export type ResearchedChannelLookup = z.infer<typeof ResearchedChannelLookup>;

/**
 * The neutral payload returned for a channel that is unknown or not yet
 * researched. Per the adjudicated design decision the lookup endpoint returns
 * 200 with this body (research_status UNRESEARCHED), NOT a 404: an unknown
 * channel is a legitimate "no data yet" state, not a client error, and the
 * extension renders a neutral "not researched" affordance from it. Asserts
 * nothing about ownership.
 */
export const UnresearchedChannelLookup = z.object({
  youtube_channel_id: z.string(),
  researched: z.literal(false),
  research_status: z.literal("UNRESEARCHED"),
  summary: z.string(),
  disclaimer: z.string(),
});
export type UnresearchedChannelLookup = z.infer<typeof UnresearchedChannelLookup>;

/** Discriminated union of the two lookup outcomes, keyed by `researched`. */
export const ChannelLookupPayload = z.discriminatedUnion("researched", [
  ResearchedChannelLookup,
  UnresearchedChannelLookup,
]);
export type ChannelLookupPayload = z.infer<typeof ChannelLookupPayload>;

/**
 * Body of `POST /api/v1/corrections` (§17.1, §23.3 "Report an Error"). A member
 * of the public disputes a specific published record. The channel is identified
 * by its immutable YouTube channel ID (never display name); an optional
 * `claim_id` scopes the dispute to one claim. Submitter identity is OPTIONAL —
 * anonymous corrections are allowed (§32.1 controls live in review, not intake)
 * — but a substantive `explanation` is required so a reviewer has something to
 * act on. All string fields are length-bounded to blunt abusive payloads.
 */
export const CorrectionSubmission = z.object({
  youtube_channel_id: YoutubeChannelId,
  claim_id: z.uuid().optional(),
  submitter_name: z.string().min(1).max(200).optional(),
  submitter_email: z.email().max(320).optional(),
  submitter_relationship: z.string().min(1).max(200).optional(),
  explanation: z.string().min(20).max(5000),
});
export type CorrectionSubmission = z.infer<typeof CorrectionSubmission>;

/**
 * Body of `POST /api/v1/submissions` (§17.1 "Submit Research Lead"). A member of
 * the public proposes a channel worth researching, ideally with a supporting
 * evidence URL. This is a LEAD, never a published claim (§7.1: leads are Tier-4
 * intake), so it carries no classification and asserts nothing — it only queues
 * work for reviewers. Submitter identity is optional; a note is optional but
 * bounded.
 */
export const ResearchLeadSubmission = z.object({
  youtube_channel_id: YoutubeChannelId,
  evidence_url: z.url().max(2000).optional(),
  submitter_name: z.string().min(1).max(200).optional(),
  submitter_email: z.email().max(320).optional(),
  note: z.string().min(1).max(5000).optional(),
});
export type ResearchLeadSubmission = z.infer<typeof ResearchLeadSubmission>;
