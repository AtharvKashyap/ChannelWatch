import { getCacheEntry, setCacheEntry } from "./cache.js";
import { fetchChannelLookup } from "./api-client.js";
import { selectTtlMs } from "./ttl.js";
import { API_BASE_URL } from "../shared/config.js";
import { isLookupChannelRequest, type LookupChannelResponse } from "../shared/messages.js";

/**
 * Handles a `LOOKUP_CHANNEL` request: serve from the in-memory session cache
 * when a fresh entry exists, otherwise fetch, cache (success OR error, per
 * §18.6 TTLs), and respond. The API base URL is baked at build time
 * (`VITE_API_BASE_URL`); nothing is read from `chrome.storage`. Exported so
 * unit tests can drive it without going through `chrome.runtime.onMessage`.
 */
export async function handleLookupChannel(channelId: string): Promise<LookupChannelResponse> {
  const cached = getCacheEntry(channelId);
  if (cached) {
    if (cached.kind === "success") {
      return { ok: true, payload: cached.payload, cached: true };
    }
    return { ok: false, error: "Cached API error; will retry after TTL expiry." };
  }

  const extensionVersion = chrome.runtime.getManifest().version;
  const result = await fetchChannelLookup(channelId, API_BASE_URL, extensionVersion);

  if (result.ok) {
    const ttl = selectTtlMs({ kind: "success", payload: result.payload });
    setCacheEntry(channelId, { kind: "success", payload: result.payload }, ttl);
    return { ok: true, payload: result.payload, cached: false };
  }

  const ttl = selectTtlMs({ kind: "error" });
  setCacheEntry(channelId, { kind: "error" }, ttl);
  return { ok: false, error: result.message };
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

  return undefined;
});
