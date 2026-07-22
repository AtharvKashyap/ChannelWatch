/**
 * The ownership panel (SPEC §18.3), opened from the badge. A React component
 * rendered INTO a Shadow DOM host (see `panel-host.ts`) so YouTube's styles
 * can't reach it and ours can't leak out.
 *
 * Every user-facing string comes from `@channelwatch/schemas` (`BADGE_LABELS`,
 * `CONFIDENCE_LABEL_TEXT`, `CREATOR_STATUS_TEXT`, `EXPLANATION_TEXT`,
 * `PANEL_COPY`, `EDITORIAL_DISCLAIMER`) — no inline prose (CLAUDE.md rule 2).
 * The standing disclaimer is shown verbatim.
 *
 * The in-panel "Report an Error" form posts a `CorrectionSubmission` via the
 * `onSubmitCorrection` prop (wired to the background SW). The body carries ONLY
 * the immutable channel id plus what the user typed — never a page URL, video
 * id, or any viewing context (CLAUDE.md rule 5).
 *
 * Note on evidence: SPEC §17.2's lookup response exposes an `evidence_count`,
 * not an itemized evidence array, so the panel shows the count. A detailed
 * title/publisher/tier list needs a schema/API field this task's scope does not
 * add; it is deferred (see task report).
 */
import { useEffect, useRef, useState } from "react";
import {
  BADGE_LABELS,
  CHAIN_COPY,
  CONFIDENCE_LABEL_TEXT,
  CREATOR_STATUS_TEXT,
  EXPLANATION_TEXT,
  PANEL_COPY,
  EDITORIAL_DISCLAIMER,
  CORRECTION_RECEIVED,
  evidenceCountText,
  lastReviewedText,
  ownershipMechanismText,
  ownershipStakeText,
  type CorrectionSubmission,
  type OwnershipChainStep,
  type ResearchedChannelLookup,
} from "@channelwatch/schemas";
import type { SubmitCorrectionResponse } from "../shared/messages.js";

/** Minimum explanation length — mirrors `CorrectionSubmission.explanation` (§17.1). */
const MIN_EXPLANATION_LENGTH = 20;

export interface OwnershipPanelProps {
  payload: ResearchedChannelLookup;
  onClose: () => void;
  onSubmitCorrection: (submission: CorrectionSubmission) => Promise<SubmitCorrectionResponse>;
}

type FormState =
  { kind: "editing"; error: string | null } | { kind: "submitting" } | { kind: "done" };

export function OwnershipPanel({ payload, onClose, onSubmitCorrection }: OwnershipPanelProps) {
  const [explanation, setExplanation] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [form, setForm] = useState<FormState>({ kind: "editing", error: null });
  const closeRef = useRef<HTMLButtonElement>(null);

  const label = payload.classification.label;

  // Accessibility: move focus into the dialog on open, close on Escape, and
  // restore focus to whatever was focused before (the badge) on unmount.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [onClose]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (explanation.trim().length < MIN_EXPLANATION_LENGTH) {
      setForm({ kind: "editing", error: PANEL_COPY.explanationTooShort });
      return;
    }

    // Build the submission from ONLY the channel id + what the user typed.
    const submission: CorrectionSubmission = {
      youtube_channel_id: payload.youtube_channel_id,
      explanation: explanation.trim(),
    };
    if (name.trim()) submission.submitter_name = name.trim();
    if (email.trim()) submission.submitter_email = email.trim();
    if (relationship.trim()) submission.submitter_relationship = relationship.trim();

    setForm({ kind: "submitting" });
    try {
      const result = await onSubmitCorrection(submission);
      setForm(result.ok ? { kind: "done" } : { kind: "editing", error: PANEL_COPY.submitError });
    } catch {
      setForm({ kind: "editing", error: PANEL_COPY.submitError });
    }
  }

  return (
    <section
      className="cw-panel"
      role="dialog"
      aria-modal="true"
      aria-label={PANEL_COPY.panelTitle}
    >
      <header className="cw-panel__head">
        <h2 className="cw-panel__title">{PANEL_COPY.panelTitle}</h2>
        <button
          type="button"
          ref={closeRef}
          className="cw-panel__close"
          aria-label={PANEL_COPY.close}
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <p className="cw-panel__label" data-cw-color={payload.badge_color}>
        {BADGE_LABELS[label]}
      </p>
      <p className="cw-panel__summary">{payload.classification.summary}</p>

      <dl className="cw-panel__facts">
        {payload.direct_owner && (
          <Fact term={PANEL_COPY.directOwnerLabel} value={payload.direct_owner.name} />
        )}
        {payload.ultimate_parent && (
          <Fact term={PANEL_COPY.ultimateParentLabel} value={payload.ultimate_parent.name} />
        )}
        {payload.creator_status && (
          <Fact
            term={PANEL_COPY.creatorStatusLabel}
            value={CREATOR_STATUS_TEXT[payload.creator_status.status]}
          />
        )}
        <Fact
          term={PANEL_COPY.confidenceLabel}
          value={CONFIDENCE_LABEL_TEXT[payload.classification.confidence_label]}
        />
        <Fact term={PANEL_COPY.evidenceLabel} value={evidenceCountText(payload.evidence_count)} />
      </dl>

      {payload.ownership_chain && payload.ownership_chain.length > 0 && (
        <div className="cw-panel__chain">
          <h3>{CHAIN_COPY.heading}</h3>
          <ol className="cw-chain">
            {payload.ownership_chain.map((step, i) => (
              <ChainHop key={`${step.name}-${i}`} step={step} />
            ))}
          </ol>
        </div>
      )}

      {payload.warnings.length > 0 && (
        <div className="cw-panel__warnings">
          <h3>{PANEL_COPY.warningsLabel}</h3>
          <ul>
            {payload.warnings.map((code) => (
              <li key={code}>{EXPLANATION_TEXT[code]}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="cw-panel__reviewed">{lastReviewedText(payload.last_reviewed_at)}</p>
      <p className="cw-panel__disclaimer">{EDITORIAL_DISCLAIMER}</p>

      <form className="cw-panel__correction" onSubmit={handleSubmit}>
        <h3>{PANEL_COPY.correctionHeading}</h3>
        {form.kind === "done" ? (
          <p role="status" className="cw-panel__receipt">
            {CORRECTION_RECEIVED}
          </p>
        ) : (
          <>
            <label>
              {PANEL_COPY.explanationLabel}
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder={PANEL_COPY.explanationPlaceholder}
                rows={4}
              />
            </label>
            <label>
              {PANEL_COPY.nameLabel}
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              {PANEL_COPY.emailLabel}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              {PANEL_COPY.relationshipLabel}
              <input
                type="text"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
              />
            </label>
            {form.kind === "editing" && form.error && (
              <p role="alert" className="cw-panel__error">
                {form.error}
              </p>
            )}
            <button type="submit" disabled={form.kind === "submitting"}>
              {form.kind === "submitting" ? PANEL_COPY.submitting : PANEL_COPY.submit}
            </button>
          </>
        )}
      </form>
    </section>
  );
}

/**
 * One hop of the ownership chain: the FULL (untruncated) entity name, the
 * neutral sourced mechanism, the stake (exact percentage when disclosed, else
 * "stake not publicly disclosed"), and the effective-from date when present. All
 * strings come from the reviewed copy module.
 */
function ChainHop({ step }: { step: OwnershipChainStep }) {
  const mechanism = ownershipMechanismText(step.relationship, step.control_level);
  const stake = ownershipStakeText(step.ownership_percentage);
  return (
    <li className="cw-chain__hop">
      <span className="cw-chain__name">{step.name}</span>
      <span className="cw-chain__meta">
        {mechanism} · {stake}
        {step.effective_from ? ` · ${CHAIN_COPY.effectiveFromPrefix} ${step.effective_from}` : ""}
      </span>
    </li>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="cw-fact">
      <dt>{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}
