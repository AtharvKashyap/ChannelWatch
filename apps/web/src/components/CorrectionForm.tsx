"use client";

import { useState } from "react";
import {
  CORRECTION_PAGE_COPY,
  CORRECTION_RECEIVED,
  PANEL_COPY,
  YoutubeChannelId,
  type CorrectionSubmission,
} from "@channelwatch/schemas";
import { submitCorrection, type ApiResult, type SubmissionReceipt } from "../lib/api-client.js";

/** Minimum explanation length — mirrors `CorrectionSubmission.explanation` (§17.1). */
const MIN_EXPLANATION_LENGTH = 20;

/**
 * The standalone public correction form (`/corrections`, SPEC §23.3 "Report an
 * Error"). Unlike the in-panel extension form, it takes the channel ID as input
 * (the extension already knows the channel; a site visitor may not be on one).
 * It validates the channel ID and explanation client-side, posts a
 * `CorrectionSubmission` through the api-client, and shows honest success /
 * failure states from the reviewed copy module (CLAUDE.md rule 2). The submit
 * handler is injectable so the state machine is unit-testable without a network.
 */
export interface CorrectionFormProps {
  /** Optional channel ID to prefill (e.g. linked from a channel page). */
  initialChannelId?: string;
  /** Override the network call — defaults to the real api-client `submitCorrection`. */
  onSubmit?: (submission: CorrectionSubmission) => Promise<ApiResult<SubmissionReceipt>>;
}

type FormState =
  | { kind: "editing"; error: string | null }
  | { kind: "submitting" }
  | { kind: "done" };

export function CorrectionForm({ initialChannelId = "", onSubmit }: CorrectionFormProps) {
  const submit = onSubmit ?? submitCorrection;
  const [channelId, setChannelId] = useState(initialChannelId);
  const [explanation, setExplanation] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [form, setForm] = useState<FormState>({ kind: "editing", error: null });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!YoutubeChannelId.safeParse(channelId.trim()).success) {
      setForm({ kind: "editing", error: CORRECTION_PAGE_COPY.channelIdInvalid });
      return;
    }
    if (explanation.trim().length < MIN_EXPLANATION_LENGTH) {
      setForm({ kind: "editing", error: PANEL_COPY.explanationTooShort });
      return;
    }

    const submission: CorrectionSubmission = {
      youtube_channel_id: channelId.trim(),
      explanation: explanation.trim(),
    };
    if (name.trim()) submission.submitter_name = name.trim();
    if (email.trim()) submission.submitter_email = email.trim();
    if (relationship.trim()) submission.submitter_relationship = relationship.trim();

    setForm({ kind: "submitting" });
    try {
      const result = await submit(submission);
      setForm(result.ok ? { kind: "done" } : { kind: "editing", error: PANEL_COPY.submitError });
    } catch {
      setForm({ kind: "editing", error: PANEL_COPY.submitError });
    }
  }

  if (form.kind === "done") {
    return (
      <p role="status" className="cw-correction__receipt">
        {CORRECTION_RECEIVED}
      </p>
    );
  }

  return (
    <form className="cw-correction" onSubmit={handleSubmit}>
      <label>
        {CORRECTION_PAGE_COPY.channelIdLabel}
        <input
          type="text"
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          placeholder={CORRECTION_PAGE_COPY.channelIdPlaceholder}
        />
      </label>
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
        <p role="alert" className="cw-correction__error">
          {form.error}
        </p>
      )}
      <button type="submit" disabled={form.kind === "submitting"}>
        {form.kind === "submitting" ? PANEL_COPY.submitting : PANEL_COPY.submit}
      </button>
    </form>
  );
}
