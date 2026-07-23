"use client";

import { REVIEW_CONSOLE_COPY as C, type AuditEventItem } from "@channelwatch/schemas";

/**
 * The audit viewer (§26.5): a paginated, subject-filterable table of audit
 * events. Presentational — the caller supplies the current page of events and
 * the pagination/ filter callbacks. Copy comes from the reviewed module
 * (CLAUDE.md rule 2).
 */
export interface AuditTableProps {
  events: AuditEventItem[];
  subjectFilter: string;
  onSubjectFilterChange: (value: string) => void;
  onApplyFilter: () => void;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function AuditTable({
  events,
  subjectFilter,
  onSubjectFilterChange,
  onApplyFilter,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: AuditTableProps) {
  return (
    <section className="cw-audit" aria-label={C.auditHeading}>
      <h2>{C.auditHeading}</h2>
      <div className="cw-audit-filter">
        <label>
          {C.auditFilterLabel}
          <input
            className="cw-audit-subject"
            value={subjectFilter}
            onChange={(e) => onSubjectFilterChange(e.target.value)}
          />
        </label>
        <button type="button" className="cw-audit-apply" onClick={onApplyFilter}>
          {C.auditFilterApply}
        </button>
      </div>

      {events.length === 0 ? (
        <p className="cw-empty">{C.auditEmpty}</p>
      ) : (
        <table className="cw-audit-table">
          <thead>
            <tr>
              <th>{C.colWhen}</th>
              <th>{C.colActor}</th>
              <th>{C.colAction}</th>
              <th>{C.colObject}</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="cw-audit-row">
                <td>{event.created_at ?? "—"}</td>
                <td>{event.actor_id ?? "—"}</td>
                <td className="cw-audit-action">{event.action}</td>
                <td>
                  {event.object_type}
                  {event.object_id ? ` · ${event.object_id}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="cw-audit-pager">
        <button type="button" className="cw-prev" onClick={onPrev} disabled={!canPrev}>
          {C.prev}
        </button>
        <button type="button" className="cw-next" onClick={onNext} disabled={!canNext}>
          {C.next}
        </button>
      </div>
    </section>
  );
}
