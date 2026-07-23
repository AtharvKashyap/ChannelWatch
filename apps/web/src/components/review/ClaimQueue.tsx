"use client";

import {
  CLAIM_STATUSES,
  REVIEW_CONSOLE_COPY as C,
  type ClaimQueueItem,
} from "@channelwatch/schemas";
import { ConfidenceLabel } from "../ConfidenceLabel.js";

/**
 * The claim queue table (§19.5 "View candidate claims", §20). Presentational:
 * it renders the claims it is given and raises `onApprove`/`onReject` with the
 * chosen claim. The two-person-review flag (§20.3) is surfaced explicitly per
 * row (a process flag — "second review required" — never an accusation) and the
 * "awaiting a second reviewer" state is shown when a sensitive claim has one
 * approval. All copy comes from the reviewed module (CLAUDE.md rule 2).
 */
export interface ClaimQueueProps {
  claims: ClaimQueueItem[];
  statusFilter: string;
  onStatusChange: (status: string) => void;
  onApprove: (claim: ClaimQueueItem) => void;
  onReject: (claim: ClaimQueueItem) => void;
}

function claimLabel(claim: ClaimQueueItem): string {
  const subject = claim.subject_name ?? claim.subject_id;
  const object = claim.object_name ?? claim.object_id ?? "";
  return object ? `${subject} · ${claim.predicate} · ${object}` : `${subject} · ${claim.predicate}`;
}

function isReviewable(status: string | null): boolean {
  return (
    status === null || status === "DRAFT" || status === "UNDER_REVIEW" || status === "DISPUTED"
  );
}

export function ClaimQueue({
  claims,
  statusFilter,
  onStatusChange,
  onApprove,
  onReject,
}: ClaimQueueProps) {
  return (
    <section className="cw-queue" aria-label={C.queueHeading}>
      <h2>{C.queueHeading}</h2>
      <label className="cw-queue-filter">
        {C.queueFilterLabel}
        <select value={statusFilter} onChange={(e) => onStatusChange(e.target.value)}>
          <option value="">{C.queueFilterAll}</option>
          {CLAIM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      {claims.length === 0 ? (
        <p className="cw-empty">{C.queueEmpty}</p>
      ) : (
        <table className="cw-claim-table">
          <thead>
            <tr>
              <th>{C.colClaim}</th>
              <th>{C.colStatus}</th>
              <th>{C.colConfidence}</th>
              <th>{C.colReviews}</th>
              <th>{C.colFlags}</th>
              <th>{C.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => (
              <tr key={claim.id} className="cw-claim-row" data-sensitive={claim.sensitive}>
                <td className="cw-claim-label">{claimLabel(claim)}</td>
                <td>{claim.claim_status ?? "—"}</td>
                <td>
                  {claim.confidence_label ? (
                    <ConfidenceLabel value={claim.confidence_label} />
                  ) : (
                    "—"
                  )}
                </td>
                <td>{claim.distinct_approvers}</td>
                <td className="cw-flags">
                  {claim.sensitive ? (
                    <span className="cw-sensitive-flag" title={C.sensitiveExplanation}>
                      {C.sensitiveFlag}
                    </span>
                  ) : null}
                  {claim.sensitive && claim.distinct_approvers === 1 ? (
                    <span className="cw-awaiting">{C.awaitingSecondReviewer}</span>
                  ) : null}
                  {claim.can_publish ? <span className="cw-ready">{C.readyToPublish}</span> : null}
                </td>
                <td className="cw-actions">
                  {isReviewable(claim.claim_status) ? (
                    <>
                      <button type="button" className="cw-approve" onClick={() => onApprove(claim)}>
                        {C.approve}
                      </button>
                      <button type="button" className="cw-reject" onClick={() => onReject(claim)}>
                        {C.reject}
                      </button>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
