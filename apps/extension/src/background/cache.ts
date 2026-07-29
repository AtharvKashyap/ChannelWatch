import type { ChannelLookupPayload } from "@channelwatch/schemas";

/**
 * In-memory session cache for channel lookups. A plain `Map` keyed ONLY by
 * `youtube_channel_id`, living in the background service worker's memory.
 *
 * PRIVACY (hard rule, CLAUDE.md #5 / PRIVACY.md): this is NEVER persisted to
 * disk. It is not `chrome.storage`; it holds no page URL, video ID, timestamp
 * of viewing, or anything about the user. It is gone when the service worker is
 * torn down or the browser restarts, so it cannot be read back as a browsing
 * history. It exists only to avoid re-fetching the same channel repeatedly
 * within a single session.
 */

interface ErrorEntry {
  kind: "error";
}

interface SuccessEntry {
  kind: "success";
  payload: ChannelLookupPayload;
}

interface CacheEntry {
  expiresAt: number;
  data: ErrorEntry | SuccessEntry;
}

/** Soft cap on entries, purely to bound worker memory. */
export const CACHE_MAX_ENTRIES = 500;

const store = new Map<string, CacheEntry>();

/**
 * Returns the cached lookup outcome for `channelId` if present and not expired,
 * else `undefined` (a miss). An expired entry is deleted on access.
 */
export function getCacheEntry(
  channelId: string,
  now: number = Date.now(),
): ErrorEntry | SuccessEntry | undefined {
  const entry = store.get(channelId);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    store.delete(channelId);
    return undefined;
  }
  // Refresh recency: re-insert so this key is now the most-recently-used
  // (Map preserves insertion order, so the first key is the oldest).
  store.delete(channelId);
  store.set(channelId, entry);
  return entry.data;
}

/**
 * Inserts/overwrites the cache entry for `channelId` with a TTL, then evicts the
 * oldest entries if the store exceeds `CACHE_MAX_ENTRIES`.
 */
export function setCacheEntry(
  channelId: string,
  data: ErrorEntry | SuccessEntry,
  ttlMs: number,
  now: number = Date.now(),
): void {
  store.delete(channelId);
  store.set(channelId, { expiresAt: now + ttlMs, data });

  while (store.size > CACHE_MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/** Test/diagnostic helper: number of entries currently cached. */
export function cacheSize(): number {
  return store.size;
}

/** Test-only: empties the session cache so tests don't leak into each other. */
export function clearCacheForTests(): void {
  store.clear();
}
