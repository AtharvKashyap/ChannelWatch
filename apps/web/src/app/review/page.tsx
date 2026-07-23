"use client";

import { useCallback, useEffect, useState } from "react";
import {
  REVIEW_CONSOLE_COPY as C,
  type ClaimQueueItem,
} from "@channelwatch/schemas";
import { ClaimQueue, ReasoningDialog } from "../../components/review/index.js";
import { approveClaim, fetchClaimQueue, rejectClaim } from "../../lib/review-client.js";
import { ReviewShell } from "./ReviewShell.js";

type Pending = { claim: ClaimQueueItem; mode: "approve" | "reject" } | null;

export default function QueuePage() {
  const [claims, setClaims] = useState<ClaimQueueItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const reload = useCallback(async (status: string) => {
    const result = await fetchClaimQueue(status || undefined);
    if (result.ok) setClaims(result.data.claims);
  }, []);

  useEffect(() => {
    void reload(statusFilter);
  }, [reload, statusFilter]);

  const onConfirm = async (reasoning: string) => {
    if (!pending) return;
    setBusy(true);
    setError(false);
    const action = pending.mode === "approve" ? approveClaim : rejectClaim;
    const result = await action(pending.claim.id, reasoning);
    setBusy(false);
    if (result.ok) {
      setPending(null);
      await reload(statusFilter);
    } else {
      setError(true);
    }
  };

  return (
    <ReviewShell active="queue">
      {error ? (
        <p className="cw-error" role="alert">
          {C.actionError}
        </p>
      ) : null}
      <ClaimQueue
        claims={claims}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        onApprove={(claim) => setPending({ claim, mode: "approve" })}
        onReject={(claim) => setPending({ claim, mode: "reject" })}
      />
      {pending ? (
        <ReasoningDialog
          heading={
            pending.mode === "approve"
              ? C.reviewDialogApproveHeading
              : C.reviewDialogRejectHeading
          }
          busy={busy}
          onConfirm={onConfirm}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </ReviewShell>
  );
}
