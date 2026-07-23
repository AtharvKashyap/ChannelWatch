import { z } from "zod";
import {
  ClaimStatusSchema,
  EntityTypeSchema,
  ConfidenceLabelSchema,
} from "./enums.js";

/**
 * Zod schemas for the authenticated `/review` console (SPEC §17 authed
 * endpoints, §19.5 reviewer capabilities, §20 review workflow). These are the
 * single source of truth for the reviewer request/response shapes: the API
 * self-enforces them before responding and `apps/web` validates every response
 * against them (CLAUDE.md — schemas are the one source of truth, never redefined
 * per-app).
 *
 * All fields are snake_case to match the public API surface. Response shapes
 * deliberately expose only what a reviewer needs; classification labels remain
 * COMPUTED (never entered here), consistent with the data-model rule that claims
 * are the review artifact and classification is derived (docs/data-model.md).
 */

// ---- Auth ----------------------------------------------------------------

/** `POST /api/v1/auth/login` body. Password is never logged or echoed. */
export const LoginRequest = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(1024),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

/** A reviewer's public profile (never carries the password hash). */
export const ReviewerProfile = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  display_name: z.string().nullable(),
  role: z.string().nullable(),
});
export type ReviewerProfile = z.infer<typeof ReviewerProfile>;

/** `POST /auth/login` and `GET /auth/me` response. */
export const SessionResponse = z.object({
  reviewer: ReviewerProfile,
});
export type SessionResponse = z.infer<typeof SessionResponse>;

// ---- Claim queue + review decisions (§20) --------------------------------

/**
 * Reviewer reasoning is REQUIRED for every approve/reject (§20.2 "Record
 * reviewer reasoning"). Bounded to blunt abusive payloads; min length forces a
 * substantive rationale rather than an empty click.
 */
export const ReviewDecisionRequest = z.object({
  reasoning: z.string().min(10).max(5000),
});
export type ReviewDecisionRequest = z.infer<typeof ReviewDecisionRequest>;

/** One recorded reviewer decision on a claim (`reviews` row, §20.2). */
export const ReviewRecord = z.object({
  id: z.string().min(1),
  reviewer_id: z.string().nullable(),
  decision: z.string().nullable(),
  reasoning: z.string().nullable(),
  reviewed_at: z.string().nullable(),
});
export type ReviewRecord = z.infer<typeof ReviewRecord>;

/**
 * A claim as shown in the reviewer queue. Carries its review-workflow state, the
 * resolved subject/object display names, and the TWO-PERSON-REVIEW decision
 * surface (§20.3): `sensitive` marks a claim that needs a second distinct
 * reviewer, `distinct_approvers` counts how many distinct reviewers have
 * approved, and `can_publish` is the server's computed verdict on whether the
 * next approval would publish. `sensitive` is a process flag, NOT an accusation.
 */
export const ClaimQueueItem = z.object({
  id: z.string().min(1),
  subject_type: z.string(),
  subject_id: z.string(),
  subject_name: z.string().nullable(),
  predicate: z.string(),
  object_type: z.string().nullable(),
  object_id: z.string().nullable(),
  object_name: z.string().nullable(),
  confidence: z.number().nullable(),
  confidence_label: ConfidenceLabelSchema.nullable(),
  claim_status: ClaimStatusSchema.nullable(),
  effective_date: z.string().nullable(),
  review_notes: z.string().nullable(),
  sensitive: z.boolean(),
  distinct_approvers: z.number().int().nonnegative(),
  can_publish: z.boolean(),
  reviews: z.array(ReviewRecord),
});
export type ClaimQueueItem = z.infer<typeof ClaimQueueItem>;

export const ClaimQueueResponse = z.object({
  count: z.number().int().nonnegative(),
  claims: z.array(ClaimQueueItem),
});
export type ClaimQueueResponse = z.infer<typeof ClaimQueueResponse>;

/** Result of an approve/reject action, echoing the claim's new state. */
export const ReviewActionResponse = z.object({
  claim_id: z.string().min(1),
  claim_status: ClaimStatusSchema.nullable(),
  distinct_approvers: z.number().int().nonnegative(),
  published: z.boolean(),
  awaiting_second_reviewer: z.boolean(),
});
export type ReviewActionResponse = z.infer<typeof ReviewActionResponse>;

// ---- Entity CRUD (§19.5) -------------------------------------------------

export const EntityRecord = z.object({
  id: z.string().min(1),
  entity_type: EntityTypeSchema,
  canonical_name: z.string().min(1),
  legal_name: z.string().nullable(),
  jurisdiction: z.string().nullable(),
  registry_identifier: z.string().nullable(),
  website: z.string().nullable(),
  description: z.string().nullable(),
});
export type EntityRecord = z.infer<typeof EntityRecord>;

export const EntityListResponse = z.object({
  count: z.number().int().nonnegative(),
  entities: z.array(EntityRecord),
});
export type EntityListResponse = z.infer<typeof EntityListResponse>;

/** Create body: a valid entity type + canonical name are required. */
export const EntityCreateRequest = z.object({
  entity_type: EntityTypeSchema,
  canonical_name: z.string().min(1).max(500),
  legal_name: z.string().max(500).nullable().optional(),
  jurisdiction: z.string().max(200).nullable().optional(),
  registry_identifier: z.string().max(200).nullable().optional(),
  website: z.url().max(2000).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
});
export type EntityCreateRequest = z.infer<typeof EntityCreateRequest>;

/** Update body: every field optional, but at least one must be present. */
export const EntityUpdateRequest = EntityCreateRequest.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "At least one field must be provided." },
);
export type EntityUpdateRequest = z.infer<typeof EntityUpdateRequest>;

// ---- Correction inbox (§23.3, §24) ---------------------------------------

export const CorrectionInboxItem = z.object({
  id: z.string().min(1),
  channel_id: z.string().nullable(),
  claim_id: z.string().nullable(),
  submitter_name: z.string().nullable(),
  submitter_email: z.string().nullable(),
  submitter_relationship: z.string().nullable(),
  explanation: z.string().nullable(),
  status: z.string().nullable(),
  submitted_at: z.string().nullable(),
  resolved_at: z.string().nullable(),
  resolution: z.string().nullable(),
});
export type CorrectionInboxItem = z.infer<typeof CorrectionInboxItem>;

export const CorrectionInboxResponse = z.object({
  count: z.number().int().nonnegative(),
  corrections: z.array(CorrectionInboxItem),
});
export type CorrectionInboxResponse = z.infer<typeof CorrectionInboxResponse>;

/** Resolving or dismissing a correction requires a recorded reasoning note. */
export const CorrectionResolutionRequest = z.object({
  reasoning: z.string().min(10).max(5000),
});
export type CorrectionResolutionRequest = z.infer<typeof CorrectionResolutionRequest>;

// ---- Audit viewer (§26.5) ------------------------------------------------

export const AuditEventItem = z.object({
  id: z.string().min(1),
  actor_id: z.string().nullable(),
  action: z.string(),
  object_type: z.string(),
  object_id: z.string().nullable(),
  before_state: z.unknown().nullable(),
  after_state: z.unknown().nullable(),
  created_at: z.string().nullable(),
});
export type AuditEventItem = z.infer<typeof AuditEventItem>;

export const AuditListResponse = z.object({
  count: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  events: z.array(AuditEventItem),
});
export type AuditListResponse = z.infer<typeof AuditListResponse>;
