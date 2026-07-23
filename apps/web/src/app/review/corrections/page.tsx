"use client";

import { useCallback, useEffect, useState } from "react";
import {
  REVIEW_CONSOLE_COPY as C,
  type CorrectionInboxItem,
} from "@channelwatch/schemas";
import { CorrectionInbox, ReasoningDialog } from "../../../components/review/index.js";
import {
  dismissCorrection,
  fetchCorrections,
  resolveCorrection,
} from "../../../lib/review-client.js";
import { ReviewShell } from "../ReviewShell.js";

type Pending = { item: CorrectionInboxItem; mode: "resolve" | "dismiss" } | null;

export default function CorrectionsPage() {
  const [corrections, setCorrections] = useState<CorrectionInboxItem[]>([]);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    const result = await fetchCorrections();
    if (result.ok) setCorrections(result.data.corrections);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onConfirm = async (reasoning: string) => {
    if (!pending) return;
    setBusy(true);
    setError(false);
    const action = pending.mode === "resolve" ? resolveCorrection : dismissCorrection;
    const result = await action(pending.item.id, reasoning);
    setBusy(false);
    if (result.ok) {
      setPending(null);
      await reload();
    } else {
      setError(true);
    }
  };

  return (
    <ReviewShell active="corrections">
      {error ? (
        <p className="cw-error" role="alert">
          {C.actionError}
        </p>
      ) : null}
      <CorrectionInbox
        corrections={corrections}
        onResolve={(item) => setPending({ item, mode: "resolve" })}
        onDismiss={(item) => setPending({ item, mode: "dismiss" })}
      />
      {pending ? (
        <ReasoningDialog
          heading={
            pending.mode === "resolve" ? C.correctionResolveHeading : C.correctionDismissHeading
          }
          label={C.resolutionLabel}
          placeholder={C.resolutionPlaceholder}
          busy={busy}
          onConfirm={onConfirm}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </ReviewShell>
  );
}
