import { desc, eq, inArray, sql } from "drizzle-orm";
import {
  confidenceLabelFromScore,
  type AuditEventItem,
  type AuditListResponse,
  type ClaimQueueItem,
  type ConfidenceLabel,
  type CorrectionInboxItem,
  type EntityCreateRequest,
  type EntityRecord,
  type EntityUpdateRequest,
  type ReviewActionResponse,
  type ReviewRecord,
} from "@channelwatch/schemas";
import type { Database } from "../db/client.js";
import {
  auditEvents,
  channels,
  claims,
  correctionRequests,
  entities,
  reviews,
} from "../db/schema.js";
import { recomputeClassifications } from "../db/recompute.js";
import { badRequest, conflict, notFound } from "../http/middleware.js";
import { canPublish as canPublishRule, isSensitiveClaim } from "./two-person.js";

/**
 * Data operations behind the authed reviewer API (SPEC §17 authed endpoints,
 * §19.5, §20). Kept apart from the HTTP router so the review-workflow logic —
 * especially the two-person publication rule (§20.3) and the audit-on-every-
 * mutation invariant (CLAUDE.md rule 6) — is testable in isolation.
 *
 * EVERY mutation here writes an `audit_events` row in the SAME transaction as
 * the change, matching the existing public write paths (`db/writes.ts`). No
 * mutation writes `channels.published_classification` directly: a publication
 * that could change the graph calls the single-writer `recomputeClassifications`
 * (docs/data-model.md).
 */

type ClaimRow = typeof claims.$inferSelect;
type ReviewRow = typeof reviews.$inferSelect;

// Claim statuses a reviewer may still act on. PUBLISHED / ARCHIVED / RETRACTED /
// CORRECTED are terminal for the approve/reject actions (a 409, not a 500).
const REVIEWABLE_STATUSES: ReadonlySet<string> = new Set(["DRAFT", "UNDER_REVIEW", "DISPUTED"]);

function isReviewable(status: string | null): boolean {
  return status === null || REVIEWABLE_STATUSES.has(status);
}

/** Build id→name and id→entityType maps for a set of subject/object ids. */
async function resolveNames(
  db: Database,
  ids: string[],
): Promise<{ name: Map<string, string>; entityType: Map<string, string> }> {
  const name = new Map<string, string>();
  const entityType = new Map<string, string>();
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (unique.length === 0) return { name, entityType };

  const entityRows = await db.select().from(entities).where(inArray(entities.id, unique));
  for (const e of entityRows) {
    name.set(e.id, e.canonicalName);
    entityType.set(e.id, e.entityType);
  }
  const channelRows = await db.select().from(channels).where(inArray(channels.id, unique));
  for (const ch of channelRows) {
    if (!name.has(ch.id)) name.set(ch.id, ch.displayName);
  }
  return { name, entityType };
}

/** Distinct reviewer ids that have APPROVED a claim, from its review rows. */
function distinctApprovers(reviewRows: ReviewRow[]): Set<string> {
  const set = new Set<string>();
  for (const r of reviewRows) {
    if (r.decision === "APPROVED" && r.reviewerId) set.add(r.reviewerId);
  }
  return set;
}

function toReviewRecord(r: ReviewRow): ReviewRecord {
  return {
    id: r.id,
    reviewer_id: r.reviewerId,
    decision: r.decision,
    reasoning: r.reasoning,
    reviewed_at: r.reviewedAt ? r.reviewedAt.toISOString() : null,
  };
}

/** Entity types participating in a claim (subject + object, when they are entities). */
function involvedTypes(claim: ClaimRow, entityType: Map<string, string>): (string | null)[] {
  return [
    entityType.get(claim.subjectId) ?? null,
    claim.objectId ? (entityType.get(claim.objectId) ?? null) : null,
  ];
}

/**
 * The claim queue (§19.5 "View candidate claims"), optionally filtered by
 * status. Each item carries the resolved names, the sensitivity flag, and the
 * two-person decision surface (§20.3).
 */
export async function listClaims(db: Database, statusFilter?: string): Promise<ClaimQueueItem[]> {
  const rows = statusFilter
    ? await db
        .select()
        .from(claims)
        .where(eq(claims.claimStatus, statusFilter))
        .orderBy(desc(claims.updatedAt))
    : await db.select().from(claims).orderBy(desc(claims.updatedAt));
  if (rows.length === 0) return [];

  const ids: string[] = [];
  for (const c of rows) {
    ids.push(c.subjectId);
    if (c.objectId) ids.push(c.objectId);
  }
  const { name, entityType } = await resolveNames(db, ids);

  const claimIds = rows.map((c) => c.id);
  const reviewRows = await db.select().from(reviews).where(inArray(reviews.claimId, claimIds));
  const reviewsByClaim = new Map<string, ReviewRow[]>();
  for (const r of reviewRows) {
    if (!r.claimId) continue;
    const list = reviewsByClaim.get(r.claimId) ?? [];
    list.push(r);
    reviewsByClaim.set(r.claimId, list);
  }

  return rows.map((c) => {
    const claimReviews = reviewsByClaim.get(c.id) ?? [];
    const sensitive = isSensitiveClaim({
      predicate: c.predicate,
      claimStatus: c.claimStatus,
      involvedEntityTypes: involvedTypes(c, entityType),
    });
    const approvers = distinctApprovers(claimReviews).size;
    const confidence = c.confidence === null ? null : Number(c.confidence);
    const confidenceLabel: ConfidenceLabel | null =
      confidence === null ? null : confidenceLabelFromScore(confidence);
    return {
      id: c.id,
      subject_type: c.subjectType,
      subject_id: c.subjectId,
      subject_name: name.get(c.subjectId) ?? null,
      predicate: c.predicate,
      object_type: c.objectType,
      object_id: c.objectId,
      object_name: c.objectId ? (name.get(c.objectId) ?? null) : null,
      confidence,
      confidence_label: confidenceLabel,
      claim_status: c.claimStatus as ClaimQueueItem["claim_status"],
      effective_date: c.effectiveDate,
      review_notes: c.reviewNotes,
      sensitive,
      distinct_approvers: approvers,
      can_publish: isReviewable(c.claimStatus) && canPublishRule(sensitive, approvers),
      reviews: claimReviews.map(toReviewRecord),
    } satisfies ClaimQueueItem;
  });
}

/** Shared approve/reject core. Records a review + status transition + audit. */
async function recordDecision(
  db: Database,
  args: {
    reviewerId: string;
    claimId: string;
    decision: "APPROVED" | "REJECTED";
    reasoning: string;
  },
): Promise<{ response: ReviewActionResponse; published: boolean }> {
  const result = await db.transaction(async (tx) => {
    const [claim] = await tx.select().from(claims).where(eq(claims.id, args.claimId));
    if (!claim) throw notFound("Claim not found.");
    if (!isReviewable(claim.claimStatus)) {
      throw conflict(
        `Claim is ${claim.claimStatus ?? "in an unknown state"} and cannot be reviewed.`,
        "CLAIM_NOT_REVIEWABLE",
      );
    }

    const { entityType } = await resolveNames(
      tx as unknown as Database,
      [claim.subjectId, claim.objectId ?? ""].filter(Boolean),
    );
    const sensitive = isSensitiveClaim({
      predicate: claim.predicate,
      claimStatus: claim.claimStatus,
      involvedEntityTypes: involvedTypes(claim, entityType),
    });

    const now = new Date();
    await tx.insert(reviews).values({
      claimId: claim.id,
      reviewerId: args.reviewerId,
      decision: args.decision,
      reasoning: args.reasoning,
      reviewedAt: now,
    });

    const claimReviews = await tx.select().from(reviews).where(eq(reviews.claimId, claim.id));
    const approvers = distinctApprovers(claimReviews);

    let newStatus: string;
    let published = false;
    let awaitingSecond = false;
    if (args.decision === "REJECTED") {
      // A rejected claim is not published; it leaves the queue as ARCHIVED. The
      // reasoning is preserved in the review row and the audit trail.
      newStatus = "ARCHIVED";
    } else if (canPublishRule(sensitive, approvers.size)) {
      newStatus = "PUBLISHED";
      published = true;
    } else {
      // Sensitive claim with a single approval: hold for a second distinct
      // reviewer (§20.3) rather than publishing.
      newStatus = "UNDER_REVIEW";
      awaitingSecond = true;
    }

    await tx
      .update(claims)
      .set({ claimStatus: newStatus, updatedAt: now })
      .where(eq(claims.id, claim.id));

    await tx.insert(auditEvents).values({
      actorId: args.reviewerId,
      action: args.decision === "APPROVED" ? "APPROVE_CLAIM" : "REJECT_CLAIM",
      objectType: "claim",
      objectId: claim.id,
      beforeState: { claim_status: claim.claimStatus },
      afterState: {
        claim_status: newStatus,
        decision: args.decision,
        sensitive,
        distinct_approvers: approvers.size,
        published,
      },
    });

    const response: ReviewActionResponse = {
      claim_id: claim.id,
      claim_status: newStatus as ReviewActionResponse["claim_status"],
      distinct_approvers: approvers.size,
      published,
      awaiting_second_reviewer: awaitingSecond,
    };
    return { response, published };
  });

  // A publication may change the active-relationship graph a channel's cached
  // classification is derived from. Call the SINGLE WRITER of
  // published_classification rather than touching the column here
  // (docs/data-model.md). Runs after the review transaction commits; it is
  // change-detected and writes its own audit rows.
  if (result.published) {
    await recomputeClassifications(db);
  }
  return result;
}

export function approveClaim(
  db: Database,
  reviewerId: string,
  claimId: string,
  reasoning: string,
): Promise<{ response: ReviewActionResponse; published: boolean }> {
  return recordDecision(db, { reviewerId, claimId, decision: "APPROVED", reasoning });
}

export function rejectClaim(
  db: Database,
  reviewerId: string,
  claimId: string,
  reasoning: string,
): Promise<{ response: ReviewActionResponse; published: boolean }> {
  return recordDecision(db, { reviewerId, claimId, decision: "REJECTED", reasoning });
}

// ---- Entity CRUD ---------------------------------------------------------

type EntityRow = typeof entities.$inferSelect;

function toEntityRecord(row: EntityRow): EntityRecord {
  return {
    id: row.id,
    entity_type: row.entityType as EntityRecord["entity_type"],
    canonical_name: row.canonicalName,
    legal_name: row.legalName,
    jurisdiction: row.jurisdiction,
    registry_identifier: row.registryIdentifier,
    website: row.website,
    description: row.description,
  };
}

export async function listEntities(db: Database): Promise<EntityRecord[]> {
  const rows = await db.select().from(entities).orderBy(entities.canonicalName);
  return rows.map(toEntityRecord);
}

export async function getEntityRecord(db: Database, id: string): Promise<EntityRecord | undefined> {
  const [row] = await db.select().from(entities).where(eq(entities.id, id));
  return row ? toEntityRecord(row) : undefined;
}

export async function createEntity(
  db: Database,
  reviewerId: string,
  body: EntityCreateRequest,
): Promise<EntityRecord> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(entities)
      .values({
        entityType: body.entity_type,
        canonicalName: body.canonical_name,
        legalName: body.legal_name ?? null,
        jurisdiction: body.jurisdiction ?? null,
        registryIdentifier: body.registry_identifier ?? null,
        website: body.website ?? null,
        description: body.description ?? null,
      })
      .returning();
    const created = row!;
    await tx.insert(auditEvents).values({
      actorId: reviewerId,
      action: "CREATE_ENTITY",
      objectType: "entity",
      objectId: created.id,
      beforeState: null,
      afterState: toEntityRecord(created) as unknown as object,
    });
    return toEntityRecord(created);
  });
}

export async function updateEntity(
  db: Database,
  reviewerId: string,
  id: string,
  body: EntityUpdateRequest,
): Promise<EntityRecord> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(entities).where(eq(entities.id, id));
    if (!existing) throw notFound("Entity not found.");

    const patch: Partial<EntityRow> = { updatedAt: new Date() };
    if (body.entity_type !== undefined) patch.entityType = body.entity_type;
    if (body.canonical_name !== undefined) patch.canonicalName = body.canonical_name;
    if (body.legal_name !== undefined) patch.legalName = body.legal_name;
    if (body.jurisdiction !== undefined) patch.jurisdiction = body.jurisdiction;
    if (body.registry_identifier !== undefined) patch.registryIdentifier = body.registry_identifier;
    if (body.website !== undefined) patch.website = body.website;
    if (body.description !== undefined) patch.description = body.description;

    const [row] = await tx.update(entities).set(patch).where(eq(entities.id, id)).returning();
    const updated = row!;
    await tx.insert(auditEvents).values({
      actorId: reviewerId,
      action: "UPDATE_ENTITY",
      objectType: "entity",
      objectId: id,
      beforeState: toEntityRecord(existing) as unknown as object,
      afterState: toEntityRecord(updated) as unknown as object,
    });
    return toEntityRecord(updated);
  });
}

// ---- Correction inbox ----------------------------------------------------

type CorrectionRow = typeof correctionRequests.$inferSelect;

function toCorrectionItem(row: CorrectionRow): CorrectionInboxItem {
  return {
    id: row.id,
    channel_id: row.channelId,
    claim_id: row.claimId,
    submitter_name: row.submitterName,
    submitter_email: row.submitterEmail,
    submitter_relationship: row.submitterRelationship,
    explanation: row.explanation,
    status: row.status,
    submitted_at: row.submittedAt ? row.submittedAt.toISOString() : null,
    resolved_at: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    resolution: row.resolution,
  };
}

export async function listCorrections(
  db: Database,
  statusFilter?: string,
): Promise<CorrectionInboxItem[]> {
  const rows = statusFilter
    ? await db
        .select()
        .from(correctionRequests)
        .where(eq(correctionRequests.status, statusFilter))
        .orderBy(desc(correctionRequests.submittedAt))
    : await db.select().from(correctionRequests).orderBy(desc(correctionRequests.submittedAt));
  return rows.map(toCorrectionItem);
}

/** Resolve or dismiss a correction with recorded reasoning (§23.3). */
export async function resolveCorrection(
  db: Database,
  reviewerId: string,
  id: string,
  reasoning: string,
  outcome: "RESOLVED" | "DISMISSED",
): Promise<CorrectionInboxItem> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(correctionRequests)
      .where(eq(correctionRequests.id, id));
    if (!existing) throw notFound("Correction request not found.");
    if (existing.status === "RESOLVED" || existing.status === "DISMISSED") {
      throw conflict("Correction request is already closed.", "CORRECTION_CLOSED");
    }

    const now = new Date();
    const [row] = await tx
      .update(correctionRequests)
      .set({ status: outcome, resolvedAt: now, resolution: reasoning })
      .where(eq(correctionRequests.id, id))
      .returning();
    const updated = row!;
    await tx.insert(auditEvents).values({
      actorId: reviewerId,
      action: outcome === "RESOLVED" ? "RESOLVE_CORRECTION" : "DISMISS_CORRECTION",
      objectType: "correction_request",
      objectId: id,
      beforeState: { status: existing.status },
      // PRIVACY: audit records the outcome + non-PII provenance, never the
      // submitter's email or the free-text explanation (mirrors db/writes.ts).
      afterState: { status: updated.status, has_resolution: Boolean(reasoning) },
    });
    return toCorrectionItem(updated);
  });
}

// ---- Audit viewer --------------------------------------------------------

function toAuditItem(row: typeof auditEvents.$inferSelect): AuditEventItem {
  return {
    id: row.id,
    actor_id: row.actorId,
    action: row.action,
    object_type: row.objectType,
    object_id: row.objectId,
    before_state: row.beforeState ?? null,
    after_state: row.afterState ?? null,
    created_at: row.createdAt ? row.createdAt.toISOString() : null,
  };
}

/** Paginated audit-event viewer (§26.5), optionally filtered by subject id. */
export async function listAudit(
  db: Database,
  options: { subjectId?: string; limit: number; offset: number },
): Promise<AuditListResponse> {
  const where = options.subjectId ? eq(auditEvents.objectId, options.subjectId) : undefined;
  const countRows = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(auditEvents)
    .where(where ?? sql`true`);
  const total = countRows[0]?.value ?? 0;

  const base = db.select().from(auditEvents);
  const rows = await (where ? base.where(where) : base)
    .orderBy(desc(auditEvents.createdAt))
    .limit(options.limit)
    .offset(options.offset);

  return {
    count: total,
    limit: options.limit,
    offset: options.offset,
    events: rows.map(toAuditItem),
  };
}

/** Parse + bound the pagination inputs for the audit viewer. */
export function parsePagination(
  limitRaw?: string,
  offsetRaw?: string,
): {
  limit: number;
  offset: number;
} {
  const limit = Number(limitRaw ?? "50");
  const offset = Number(offsetRaw ?? "0");
  if (!Number.isFinite(limit) || limit <= 0 || limit > 200) {
    throw badRequest("limit must be between 1 and 200.", "INVALID_LIMIT");
  }
  if (!Number.isFinite(offset) || offset < 0) {
    throw badRequest("offset must be >= 0.", "INVALID_OFFSET");
  }
  return { limit: Math.floor(limit), offset: Math.floor(offset) };
}
