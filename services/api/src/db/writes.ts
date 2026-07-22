import type { CorrectionSubmission, ResearchLeadSubmission } from "@channelwatch/schemas";
import type { Database } from "./client.js";
import { auditEvents, correctionRequests } from "./schema.js";
import { getChannelByYoutubeId } from "./queries.js";

/**
 * Public-intake write paths: corrections (§23.3) and research leads (§17.1).
 * Both land a `correction_requests` row in the review queue and — per the
 * non-negotiable audit rule (CLAUDE.md #6) — emit an `audit_events` row in the
 * SAME transaction, so no intake is ever recorded without a trail.
 *
 * PRIVACY: the audit `afterState` deliberately records only non-PII provenance
 * (channel, status, whether contact details were supplied) — never the raw
 * submitter email or free-text explanation, which live solely in the queue row.
 */

export interface IntakeResult {
  id: string;
  status: string;
}

export async function insertCorrection(
  db: Database,
  body: CorrectionSubmission,
): Promise<IntakeResult> {
  const channel = await getChannelByYoutubeId(db, body.youtube_channel_id);
  const channelId = channel?.id ?? null;

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(correctionRequests)
      .values({
        channelId,
        claimId: body.claim_id ?? null,
        submitterName: body.submitter_name ?? null,
        submitterEmail: body.submitter_email ?? null,
        submitterRelationship: body.submitter_relationship ?? null,
        explanation: body.explanation,
        status: "SUBMITTED",
        submittedAt: new Date(),
      })
      .returning();
    const created = row!;
    await tx.insert(auditEvents).values({
      action: "SUBMIT_CORRECTION",
      objectType: "correction_request",
      objectId: created.id,
      beforeState: null,
      afterState: {
        youtube_channel_id: body.youtube_channel_id,
        channel_id: channelId,
        claim_id: body.claim_id ?? null,
        status: created.status,
        has_contact: Boolean(body.submitter_email),
      },
    });
    return { id: created.id, status: created.status ?? "SUBMITTED" };
  });
}

export async function insertResearchLead(
  db: Database,
  body: ResearchLeadSubmission,
): Promise<IntakeResult> {
  const channel = await getChannelByYoutubeId(db, body.youtube_channel_id);
  const channelId = channel?.id ?? null;

  // A lead has no formal explanation field; capture its note + evidence url in
  // the queue row's explanation so a reviewer sees the full context. This is a
  // LEAD (Tier-4 intake), never a published claim (§7.1).
  const parts: string[] = [];
  if (body.note) parts.push(body.note);
  if (body.evidence_url) parts.push(`Evidence: ${body.evidence_url}`);
  const explanation = parts.join("\n") || "Research lead submitted (no note provided).";

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(correctionRequests)
      .values({
        channelId,
        submitterName: body.submitter_name ?? null,
        submitterEmail: body.submitter_email ?? null,
        submitterRelationship: "RESEARCH_LEAD",
        explanation,
        status: "SUBMITTED",
        submittedAt: new Date(),
      })
      .returning();
    const created = row!;
    await tx.insert(auditEvents).values({
      action: "SUBMIT_RESEARCH_LEAD",
      objectType: "correction_request",
      objectId: created.id,
      beforeState: null,
      afterState: {
        youtube_channel_id: body.youtube_channel_id,
        channel_id: channelId,
        status: created.status,
        has_evidence_url: Boolean(body.evidence_url),
        has_contact: Boolean(body.submitter_email),
      },
    });
    return { id: created.id, status: created.status ?? "SUBMITTED" };
  });
}
