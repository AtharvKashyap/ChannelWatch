import type { ChannelLookupPayload } from "@channelwatch/schemas";

/**
 * Local per-channel lookup cache (SPEC §18.6, §22.1). Keyed ONLY by
 * `youtube_channel_id` — there is no page URL, video ID, or timestamped
 * viewing-history list anywhere in this store, so it cannot be read back as a
 * browsing history even though it lives in `chrome.storage.local`.
 *
 * Stored as a single object under one storage key rather than one key per
 * channel: `chrome.storage.local` has no "list keys matching prefix" API, and
 * LRU eviction needs to see every entry's `lastAccessedAt` to pick a victim.
 */

const STORAGE_KEY = "cw_channel_cache_v1";

/** Hard cap on cache entries (SPEC §18.6 "do not store a long-term history"). */
export const CACHE_LRU_CAP = 500;

interface ErrorEntry {
  kind: "error";
}

interface SuccessEntry {
  kind: "success";
  payload: ChannelLookupPayload;
}

export interface CacheEntry {
  channelId: string;
  cachedAt: number;
  expiresAt: number;
  lastAccessedAt: number;
  data: ErrorEntry | SuccessEntry;
}

type CacheStore = Record<string, CacheEntry>;

async function readStore(): Promise<CacheStore> {
  const result = (await chrome.storage.local.get(STORAGE_KEY)) as Record<string, unknown>;
  const store = result[STORAGE_KEY];
  return (store as CacheStore | undefined) ?? {};
}

async function writeStore(store: CacheStore): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: store });
}

/**
 * Returns the cached entry for `channelId` if present and not yet expired,
 * bumping its `lastAccessedAt` (LRU recency) as a side effect. Returns
 * `undefined` on a miss (absent OR expired) — an expired entry is left in
 * place for the caller to overwrite via `setCacheEntry`, not deleted here.
 */
export async function getCacheEntry(
  channelId: string,
  now: number = Date.now(),
): Promise<CacheEntry | undefined> {
  const store = await readStore();
  const entry = store[channelId];
  if (!entry || entry.expiresAt <= now) return undefined;

  entry.lastAccessedAt = now;
  store[channelId] = entry;
  await writeStore(store);
  return entry;
}

/**
 * Inserts/overwrites the cache entry for `channelId`, then prunes down to
 * `CACHE_LRU_CAP` entries by evicting the least-recently-accessed ones first.
 */
export async function setCacheEntry(
  channelId: string,
  data: ErrorEntry | SuccessEntry,
  ttlMs: number,
  now: number = Date.now(),
): Promise<void> {
  const store = await readStore();
  store[channelId] = {
    channelId,
    cachedAt: now,
    expiresAt: now + ttlMs,
    lastAccessedAt: now,
    data,
  };

  const entries = Object.values(store);
  if (entries.length > CACHE_LRU_CAP) {
    entries.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
    const toEvict = entries.slice(0, entries.length - CACHE_LRU_CAP);
    for (const victim of toEvict) delete store[victim.channelId];
  }

  await writeStore(store);
}

/** Test/diagnostic helper: number of entries currently cached. */
export async function cacheSize(): Promise<number> {
  return Object.keys(await readStore()).length;
}
