import { flushPendingWrites, getCacheEntry, setCacheEntry } from "./cache.js";
import { fetchChannelLookup, submitCorrection } from "./api-client.js";
import { selectTtlMs } from "./ttl.js";
import { getSettings } from "../shared/settings.js";
import {
  isLookupChannelRequest,
  isSubmitCorrectionRequest,
  type LookupChannelResponse,
  type SubmitCorrectionResponse,
} from "../shared/messages.js";

/**
 * Handles a `LOOKUP_CHANNEL` request: serve from the local cache when a fresh
 * entry exists, otherwise fetch, cache (success OR error, per §18.6 TTLs),
 * and respond. Exported standalone so unit tests can drive it without going
 * through `chrome.runtime.onMessage`.
 */
export async function handleLookupChannel(channelId: string): Promise<LookupChannelResponse> {
  const cached = await getCacheEntry(channelId);
  if (cached) {
    if (cached.data.kind === "success") {
      return { ok: true, payload: cached.data.payload, cached: true };
    }
    return { ok: false, error: "Cached API error; will retry after TTL expiry." };
  }

  const settings = await getSettings();
  const extensionVersion = chrome.runtime.getManifest().version;
  const result = await fetchChannelLookup(channelId, settings.apiBaseUrl, extensionVersion);

  if (result.ok) {
    const ttl = selectTtlMs({ kind: "success", payload: result.payload });
    await setCacheEntry(channelId, { kind: "success", payload: result.payload }, ttl);
    return { ok: true, payload: result.payload, cached: false };
  }

  const ttl = selectTtlMs({ kind: "error" });
  await setCacheEntry(channelId, { kind: "error" }, ttl);
  return { ok: false, error: result.message };
}

/**
 * Handles a `SUBMIT_CORRECTION` request: validate + POST the correction to the
 * API. The submission is the only thing sent — channel id + what the user typed.
 * Exported standalone so unit tests can drive it directly.
 */
export async function handleSubmitCorrection(
  submission: unknown,
): Promise<SubmitCorrectionResponse> {
  const settings = await getSettings();
  const extensionVersion = chrome.runtime.getManifest().version;
  const result = await submitCorrection(submission, settings.apiBaseUrl, extensionVersion);
  return result.ok ? { ok: true } : { ok: false, error: result.message };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (isLookupChannelRequest(message)) {
    handleLookupChannel(message.channelId)
      .then(sendResponse)
      .catch((err: unknown) => {
        sendResponse({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
      });
    // Signal to the extension messaging runtime that `sendResponse` will be
    // called asynchronously.
    return true;
  }

  if (isSubmitCorrectionRequest(message)) {
    handleSubmitCorrection(message.submission)
      .then(sendResponse)
      .catch((err: unknown) => {
        sendResponse({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
      });
    return true;
  }

  return undefined;
});

// Best-effort attempt to persist any pending cache-recency (LRU) bumps before
// Chrome tears the service worker down (see `cache.ts` flushPendingWrites for
// why this is "best effort" rather than a hard guarantee).
chrome.runtime.onSuspend.addListener(() => {
  void flushPendingWrites();
});
