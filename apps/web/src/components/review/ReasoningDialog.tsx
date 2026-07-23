"use client";

import { useState } from "react";
import { REVIEW_CONSOLE_COPY as C } from "@channelwatch/schemas";

/**
 * A reasoning-capture dialog reused by every reviewer action that requires a
 * recorded rationale (§20.2 "Record reviewer reasoning", §23.3 correction
 * resolution). Pure/presentational: it owns only the textarea state and enforces
 * the >=10-char minimum locally before calling `onConfirm`. All copy comes from
 * the reviewed module (CLAUDE.md rule 2).
 */
export interface ReasoningDialogProps {
  heading: string;
  label?: string;
  placeholder?: string;
  confirmText?: string;
  busy?: boolean;
  onConfirm: (reasoning: string) => void;
  onCancel: () => void;
}

const MIN_REASONING = 10;

export function ReasoningDialog({
  heading,
  label = C.reasoningLabel,
  placeholder = C.reasoningPlaceholder,
  confirmText = C.confirm,
  busy = false,
  onConfirm,
  onCancel,
}: ReasoningDialogProps) {
  const [text, setText] = useState("");
  const [showError, setShowError] = useState(false);
  const tooShort = text.trim().length < MIN_REASONING;

  return (
    <div className="cw-dialog" role="dialog" aria-label={heading}>
      <h3>{heading}</h3>
      <label>
        {label}
        <textarea
          className="cw-reasoning"
          value={text}
          placeholder={placeholder}
          rows={4}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {showError && tooShort ? (
        <p className="cw-error" role="alert">
          {C.reasoningTooShort}
        </p>
      ) : null}
      <div className="cw-dialog-actions">
        <button type="button" className="cw-cancel" onClick={onCancel} disabled={busy}>
          {C.cancel}
        </button>
        <button
          type="button"
          className="cw-confirm"
          disabled={busy}
          onClick={() => {
            if (tooShort) {
              setShowError(true);
              return;
            }
            onConfirm(text.trim());
          }}
        >
          {confirmText}
        </button>
      </div>
    </div>
  );
}
