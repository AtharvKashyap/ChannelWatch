import type { ChannelLookupPayload } from "@channelwatch/schemas";

/**
 * Message the POPUP sends to the minimal content script to resolve the channel
 * of the currently-playing watch-page video. The content script reads the live
 * page (`document` + `document.URL`) on demand and replies — it renders NOTHING
 * into the page and stores nothing (privacy, CLAUDE.md rule 5).
 */
export const RESOLVE_CHANNEL = "RESOLVE_CHANNEL" as const;

export interface ResolveChannelRequest {
  type: typeof RESOLVE_CHANNEL;
}

export function isResolveChannelRequest(message: unknown): message is ResolveChannelRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === RESOLVE_CHANNEL
  );
}

/**
 * Content-script reply: the resolved immutable `UC…` channel id, or `null` when
 * the page is not a watch page or the channel could not be determined
 * unambiguously (never a guess — CLAUDE.md #8).
 */
export interface ResolveChannelResponse {
  channelId: string | null;
}

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
