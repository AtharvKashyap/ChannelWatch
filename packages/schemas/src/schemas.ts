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
  SourceTypeSchema,
} from "./enums.js";

/**
 * An ISO 8601 date or date-time string. Used for the DATE / TIMESTAMPTZ columns
 * that Drizzle rows surface as strings (see `services/api` mappers). Kept as a
 * lenient string rather than a coerced Date so schema objects round-trip 1:1
 * with database rows.
 */
const isoDateString = z.string().min(1);

/**
 * An evidence/source URL restricted to the `http:`/`https:` schemes. A plain
 * `z.url()` accepts dangerous schemes like `javascript:` and `data:`; since
 * these URLs are rendered as clickable links in the public web app, admitting
 * such a scheme is a stored-XSS/redirect vector. All existing research data is
 * http(s), so this only rejects malicious/malformed input.
 */
const isHttpScheme = (u: string): boolean => {
  try {
    return /^https?:$/.test(new URL(u).protocol);
  } catch {
    return false;
  }
};
const httpUrl = z.url().refine(isHttpScheme, "must be an http(s) URL");

/** Nullable+optional variant of `httpUrl` for columns that may be unset. */
const httpUrlNullish = httpUrl.nullable().optional();

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
  url: httpUrl,
  // `tier` (source_tier) and `status` are nullable TEXT/INTEGER columns (SPEC
  // §16): a source can exist before it is graded/triaged. A null column is a
  // legitimate "not yet assigned" state, so these tolerate null rather than
  // making the row unmappable. A NON-null value is still validated against the
  // enum/tier taxonomy.
  tier: SourceTierSchema.nullable().optional(),
  status: EvidenceStatusSchema.nullable().optional(),
  archive_url: httpUrlNullish,
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

/**
 * One hop of the ownership chain surfaced on the lookup response, ordered
 * channel-owner upward. ADDITIVE (M3): each step names the higher entity and
 * carries the ownership MECHANISM sourced from the relationship data —
 * relationship type, control level, and either a public percentage or null
 * ("stake not publicly disclosed"). Percentage is shown only when non-null
 * (legal-safe: never inferred). Dates are surfaced when present.
 */
export const OwnershipChainStep = z.object({
  name: z.string().min(1),
  type: EntityTypeSchema,
  relationship: RelationshipTypeSchema,
  ownership_percentage: z.number().min(0).max(100).nullable(),
  control_level: ControlLevelSchema,
  effective_from: z.string().nullable(),
});
export type OwnershipChainStep = z.infer<typeof OwnershipChainStep>;

/**
 * One ownership PERIOD in a channel's temporal ownership history (Track A),
 * ADDITIVE (M3). Names the owning/founding entity and carries the ownership
 * MECHANISM sourced from the relationship data — relationship type, control
 * level, and either a public percentage or null ("stake not publicly
 * disclosed"). `effective_from`/`effective_to` bound the period (either may be
 * null when not documented — never inferred, §23.1). `is_current` marks the
 * period that covers today (open-ended and not superseded); prior owners carry
 * `is_current: false`. History never changes the served classification (§6).
 */
export const OwnershipHistoryEntry = z.object({
  name: z.string().min(1),
  type: EntityTypeSchema,
  relationship: RelationshipTypeSchema,
  control_level: ControlLevelSchema,
  ownership_percentage: z.number().min(0).max(100).nullable(),
  effective_from: z.string().nullable(),
  effective_to: z.string().nullable(),
  is_current: z.boolean(),
});
export type OwnershipHistoryEntry = z.infer<typeof OwnershipHistoryEntry>;

/**
 * The lookup response's direct-owner reference: an `EntityRef` plus an OPTIONAL,
 * ADDITIVE (M3) `mechanism` — a neutral, data-driven phrase for how the owner
 * holds the channel (e.g. "acquired", "controlling stake"). Optional so the
 * pristine §17.2 example (which has no mechanism) still round-trips 1:1.
 */
export const DirectOwnerRef = EntityRef.extend({
  mechanism: z.string().optional(),
});
export type DirectOwnerRef = z.infer<typeof DirectOwnerRef>;

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
  // ADDITIVE (M3): `mechanism` is an optional field on the direct owner; the
  // §17.2 example omits it, so the canonical fixture still round-trips.
  direct_owner: DirectOwnerRef.nullable(),
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
  // ADDITIVE (M3): the ownership chain, channel-owner upward. Optional so the
  // pristine §17.2 example (which itemizes no chain) still validates and
  // round-trips unchanged; always populated by the live API assembler.
  ownership_chain: z.array(OwnershipChainStep).optional(),
  // ADDITIVE (M3, Track A): the temporal ownership history — ownership periods
  // newest-first, including prior owners. Optional + additive on the same
  // discipline as `ownership_chain`, so the pristine §17.2 example (which omits
  // it) still round-trips 1:1; always populated by the live API assembler.
  ownership_history: z.array(OwnershipHistoryEntry).optional(),
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
  // ADDITIVE (M3, Track C): the internal channel UUID. The public lookup is
  // keyed by YouTube channel ID, but the itemized-evidence and timeline
  // endpoints are keyed by the internal id; surfacing it here lets the public
  // site fetch those without a second lookup. Optional on the same additive
  // discipline as `ownership_chain`/`ownership_history`: the §17.2 fixture and
  // the extension (which never needs it) keep validating unchanged.
  channel_id: z.string().min(1).optional(),
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
  evidence_url: z.url().max(2000).refine(isHttpScheme, "must be an http(s) URL").optional(),
  submitter_name: z.string().min(1).max(200).optional(),
  submitter_email: z.email().max(320).optional(),
  note: z.string().min(1).max(5000).optional(),
});
export type ResearchLeadSubmission = z.infer<typeof ResearchLeadSubmission>;

/**
 * One row of `GET /api/v1/channels/search`. Channels are identified by their
 * immutable YouTube channel ID (CLAUDE.md rule 4). `classification` is the
 * cached published label (nullable — a channel row can exist before a label is
 * published); `research_status` is its §20.1 queue state. The public site links
 * each result to `/channel/{youtube_channel_id}`.
 */
export const ChannelSearchResult = z.object({
  youtube_channel_id: z.string(),
  display_name: z.string(),
  handle: z.string().nullable().optional(),
  classification: ClassificationLabelSchema.nullable().optional(),
  research_status: ResearchStatusSchema.nullable().optional(),
});
export type ChannelSearchResult = z.infer<typeof ChannelSearchResult>;

/** Body of `GET /api/v1/channels/search` — the echoed query, a count, and rows. */
export const ChannelSearchResponse = z.object({
  query: z.string(),
  count: z.number().int().nonnegative(),
  results: z.array(ChannelSearchResult),
});
export type ChannelSearchResponse = z.infer<typeof ChannelSearchResponse>;

/**
 * One itemized evidence source from `GET /api/v1/channels/:id/evidence`. A
 * superset of the §17.2 `evidence_count`: the public site renders one card per
 * source (with the standing editorial disclaimer). `tier`/`status`/`source_type`
 * are nullable (a source can exist before it is graded/triaged). Neutral,
 * structural — the card asserts nothing about editorial conduct (§23.1).
 */
export const ChannelEvidenceItem = z.object({
  id: z.string().min(1),
  url: httpUrl,
  title: z.string().nullable().optional(),
  publisher: z.string().nullable().optional(),
  tier: SourceTierSchema.nullable().optional(),
  source_type: SourceTypeSchema.nullable().optional(),
  status: EvidenceStatusSchema.nullable().optional(),
  published_at: z.string().nullable().optional(),
  archive_url: httpUrlNullish,
  excerpt: z.string().nullable().optional(),
});
export type ChannelEvidenceItem = z.infer<typeof ChannelEvidenceItem>;

/** Body of `GET /api/v1/channels/:id/evidence` — the channel id, count, sources. */
export const ChannelEvidenceResponse = z.object({
  channel_id: z.string().min(1),
  evidence_count: z.number().int().nonnegative(),
  evidence: z.array(ChannelEvidenceItem),
});
export type ChannelEvidenceResponse = z.infer<typeof ChannelEvidenceResponse>;

/**
 * One dated event on a channel's ownership timeline from
 * `GET /api/v1/channels/:id/timeline`: a relationship edge or a claim, its
 * effective date (null when undocumented — never inferred, §23.1), the two
 * participating entity names, and a lifecycle status. Presentational only.
 */
export const ChannelTimelineEvent = z.object({
  date: z.string().nullable(),
  kind: z.enum(["RELATIONSHIP", "CLAIM"]),
  type: z.string(),
  subject: z.string().nullable(),
  object: z.string().nullable(),
  status: z.string().nullable(),
});
export type ChannelTimelineEvent = z.infer<typeof ChannelTimelineEvent>;

/** Body of `GET /api/v1/channels/:id/timeline` — the channel id and its events. */
export const ChannelTimelineResponse = z.object({
  channel_id: z.string().min(1),
  events: z.array(ChannelTimelineEvent),
});
export type ChannelTimelineResponse = z.infer<typeof ChannelTimelineResponse>;
