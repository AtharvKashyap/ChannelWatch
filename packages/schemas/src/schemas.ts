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
} from "./enums.js";

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
  review_status: z.string().optional(),
  notes: z.string().optional(),
});
export type Relationship = z.infer<typeof Relationship>;

/** An evidence source backing one or more claims (§7.1, §8.2). */
export const Source = z.object({
  id: z.string().min(1),
  url: z.url(),
  tier: SourceTierSchema,
  status: EvidenceStatusSchema,
  archive_url: z.url().nullable().optional(),
  content_hash: z.string().nullable().optional(),
  retrieved_at: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
});
export type Source = z.infer<typeof Source>;

/** A discrete reviewed ownership claim (§7, §8.3). */
export const Claim = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  status: ClaimStatusSchema,
  confidence: z.number().min(0).max(1),
  confidence_label: ConfidenceLabelSchema,
  source_ids: z.array(z.string()),
  relationship_ids: z.array(z.string()).optional(),
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
