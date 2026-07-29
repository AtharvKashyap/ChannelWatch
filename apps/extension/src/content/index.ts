/**
 * Minimal content script. Its ONLY job is to resolve the immutable `UC…`
 * channel ID of the currently-playing watch-page video when the popup asks
 * (`RESOLVE_CHANNEL`), and reply. It renders NOTHING into the page — no badge,
 * no panel, no DOM mutation of any kind — and stores nothing (privacy,
 * CLAUDE.md rule 5).
 *
 * Why a declared content script rather than `chrome.scripting`: resolving is
 * done ON DEMAND against the live `document` at the moment the popup opens, so
 * whatever video is currently playing is what we resolve — no SPA-navigation
 * observer needed, and the resolver's own stale-`ytInitialData` guard handles a
 * page whose inline scripts still describe a previous video. A declared script
 * needs only the existing youtube host permission (no `scripting` permission),
 * keeping the permission set minimal.
 *
 * Fail-silent (CLAUDE.md): resolution never throws; a failure yields
 * `channelId: null`, never an exception into the page.
 */
import { resolveChannelId } from "./channel-resolver.js";
import { isResolveChannelRequest, type ResolveChannelResponse } from "../shared/messages.js";

/** Watch pages only (CLAUDE.md constraint): `/watch`, `/shorts/…`, `/live/…`. */
function isWatchPage(url: string): boolean {
  try {
    const path = new URL(url, "https://www.youtube.com").pathname;
    return path === "/watch" || path.startsWith("/shorts/") || path.startsWith("/live/");
  } catch {
    return false;
  }
}

/**
 * Resolve the current watch-page channel, reading the live document. Returns
 * `null` on non-watch pages (channel pages included — the extension deliberately
 * does nothing for them) and whenever resolution is ambiguous or unavailable.
 */
export function resolveCurrentChannel(doc: Document, url: string): string | null {
  try {
    if (!isWatchPage(url)) return null;
    return resolveChannelId(doc, url);
  } catch {
    return null;
  }
}

// Register the message responder only inside a real content-script context.
// Guarded so importing this module in unit tests has no side effects.
if (typeof chrome !== "undefined" && chrome.runtime?.id) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isResolveChannelRequest(message)) return undefined;
    const response: ResolveChannelResponse = {
      channelId: resolveCurrentChannel(document, document.URL),
    };
    sendResponse(response);
    return undefined;
  });
}
