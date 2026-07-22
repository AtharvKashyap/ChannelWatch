import type { ChannelLookupPayload, CorrectionSubmission } from "@channelwatch/schemas";

/** Message type sent from content scripts / options page to the background SW. */
export const LOOKUP_CHANNEL = "LOOKUP_CHANNEL" as const;

/**
 * Request a channel's ownership record. `channelId` is the ONLY per-request
 * identifier ever sent — never a page URL, video ID, or viewing history
 * (SPEC §22.2).
 */
export interface LookupChannelRequest {
  type: typeof LOOKUP_CHANNEL;
  channelId: string;
}

export function isLookupChannelRequest(message: unknown): message is LookupChannelRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === LOOKUP_CHANNEL &&
    typeof (message as { channelId?: unknown }).channelId === "string"
  );
}

/** Response the background SW sends back for a `LOOKUP_CHANNEL` request. */
export type LookupChannelResponse =
  { ok: true; payload: ChannelLookupPayload; cached: boolean } | { ok: false; error: string };

/**
 * Message type sent from the ownership panel's in-panel correction form to the
 * background SW. The form NEVER `fetch`es directly: routing the POST through the
 * SW avoids content-script CORS limits and keeps the API origin in one place.
 */
export const SUBMIT_CORRECTION = "SUBMIT_CORRECTION" as const;

/**
 * Request to submit a public correction (SPEC §23.3). `submission` carries ONLY
 * the immutable channel id plus what the user typed (explanation + optional
 * identity fields) — never a page URL, video id, or any viewing context
 * (CLAUDE.md rule 5). It is re-validated against `CorrectionSubmission` in the
 * SW before anything leaves the browser.
 */
export interface SubmitCorrectionRequest {
  type: typeof SUBMIT_CORRECTION;
  submission: CorrectionSubmission;
}

export function isSubmitCorrectionRequest(message: unknown): message is SubmitCorrectionRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === SUBMIT_CORRECTION &&
    typeof (message as { submission?: unknown }).submission === "object" &&
    (message as { submission?: unknown }).submission !== null
  );
}

/** Response the background SW sends back for a `SUBMIT_CORRECTION` request. */
export type SubmitCorrectionResponse = { ok: true } | { ok: false; error: string };
