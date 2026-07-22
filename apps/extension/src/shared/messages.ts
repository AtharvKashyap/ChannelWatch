import type { ChannelLookupPayload } from "@channelwatch/schemas";

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
