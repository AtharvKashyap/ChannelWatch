import type { ChannelLookupPayload } from "@channelwatch/schemas";

/**
 * Channel resolution is NO LONGER a page message. The popup resolves the current
 * watch-page channel by injecting a one-shot reader (`resolveChannelIdInPage`)
 * into the active tab via `chrome.scripting.executeScript` when it opens — see
 * `src/content/inject-resolver.ts` and `src/popup/main.tsx`. There is no
 * persistent content script and therefore no popup↔page message type here; the
 * only runtime message left is `LOOKUP_CHANNEL` (popup ↔ background SW) below.
 */

/** Message type sent from the popup to the background SW to look up a channel. */
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
