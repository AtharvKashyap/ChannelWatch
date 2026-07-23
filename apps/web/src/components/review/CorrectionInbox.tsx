"use client";

import { REVIEW_CONSOLE_COPY as C, type CorrectionInboxItem } from "@channelwatch/schemas";

/**
 * The correction inbox (§23.3, §24). Presentational: renders correction requests
 * and raises `onResolve`/`onDismiss` with the chosen item (the caller opens a
 * reasoning dialog). Copy comes from the reviewed module (CLAUDE.md rule 2).
 */
export interface CorrectionInboxProps {
  corrections: CorrectionInboxItem[];
  onResolve: (item: CorrectionInboxItem) => void;
  onDismiss: (item: CorrectionInboxItem) => void;
}

function isOpen(status: string | null): boolean {
  return status !== "RESOLVED" && status !== "DISMISSED";
}

export function CorrectionInbox({ corrections, onResolve, onDismiss }: CorrectionInboxProps) {
  return (
    <section className="cw-corrections" aria-label={C.correctionsHeading}>
      <h2>{C.correctionsHeading}</h2>
      {corrections.length === 0 ? (
        <p className="cw-empty">{C.correctionsEmpty}</p>
      ) : (
        <table className="cw-correction-table">
          <thead>
            <tr>
              <th>{C.colSubmitted}</th>
              <th>{C.colRelationship}</th>
              <th>{C.colExplanation}</th>
              <th>{C.colStatus}</th>
              <th>{C.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {corrections.map((item) => (
              <tr key={item.id} className="cw-correction-row">
                <td>{item.submitted_at ?? "—"}</td>
                <td>{item.submitter_relationship ?? "—"}</td>
                <td className="cw-correction-explanation">{item.explanation ?? "—"}</td>
                <td>{item.status ?? "—"}</td>
                <td className="cw-actions">
                  {isOpen(item.status) ? (
                    <>
                      <button
                        type="button"
                        className="cw-correction-resolve"
                        onClick={() => onResolve(item)}
                      >
                        {C.correctionResolve}
                      </button>
                      <button
                        type="button"
                        className="cw-correction-dismiss"
                        onClick={() => onDismiss(item)}
                      >
                        {C.correctionDismiss}
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
