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
 *
 * Recency (LRU) writes are batched, not synchronous per hit: rewriting the
 * whole up-to-500-entry store to `chrome.storage.local` on every cache HIT
 * just to bump one timestamp would be write-amplifying. Instead a hit records
 * its access time in an in-memory map and schedules a debounced flush; a
 * `setCacheEntry` call (which writes the store anyway, on every cache MISS)
 * folds in any pending recency bumps for free. See `flushPendingWrites` below
 * for the full trade-off (best-effort across service-worker restarts).
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

// --- Batched recency (LRU) writes -----------------------------------------
//
// `channelId -> lastAccessedAt` bumps recorded by `getCacheEntry` hits that
// have not yet been persisted. Folded into storage by the next
// `setCacheEntry` write, or after `RECENCY_FLUSH_DEBOUNCE_MS` of inactivity,
// or immediately via `flushPendingWrites()`.
let pendingAccessTimes = new Map<string, number>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;
const RECENCY_FLUSH_DEBOUNCE_MS = 2_000;

function cancelScheduledFlush(): void {
  if (flushTimer !== undefined) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }
}

function scheduleRecencyFlush(): void {
  if (flushTimer !== undefined) return;
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    void flushPendingWrites();
  }, RECENCY_FLUSH_DEBOUNCE_MS);
}

/**
 * Persists any pending recency (LRU) bumps to `chrome.storage.local`
 * immediately. Safe to call anytime, including with nothing pending.
 *
 * Call this from the service worker's `chrome.runtime.onSuspend` handler as a
 * best-effort attempt to save recency before the worker is torn down. If the
 * worker is killed WITHOUT that hook firing (Chrome does not guarantee it),
 * any not-yet-flushed hits are lost and eviction falls back to each entry's
 * last-PERSISTED access time. That is the safe direction to be wrong in: it
 * can only make a recently-touched entry look less recent than it really is
 * (so it might be evicted a little earlier than ideal), never the reverse —
 * it never invents recency for an entry that wasn't actually accessed, and it
 * never corrupts the cached data itself.
 */
export async function flushPendingWrites(): Promise<void> {
  if (pendingAccessTimes.size === 0) return;
  const pending = pendingAccessTimes;
  pendingAccessTimes = new Map();
  cancelScheduledFlush();

  const store = await readStore();
  let changed = false;
  for (const [channelId, accessedAt] of pending) {
    const entry = store[channelId];
    if (entry && accessedAt > entry.lastAccessedAt) {
      entry.lastAccessedAt = accessedAt;
      changed = true;
    }
  }
  if (changed) await writeStore(store);
}

/** Test-only: clears in-memory recency-flush state so tests don't leak into each other. */
export function resetRecencyStateForTests(): void {
  pendingAccessTimes = new Map();
  cancelScheduledFlush();
}

/**
 * Returns the cached entry for `channelId` if present and not yet expired.
 * Returns `undefined` on a miss (absent OR expired) — an expired entry is
 * left in place for the caller to overwrite via `setCacheEntry`, not deleted
 * here.
 *
 * Does NOT synchronously persist the recency bump (see batched-writes note
 * above) — it records `now` in memory and schedules a flush, but the entry
 * this call returns already reflects `now` so in-process LRU decisions this
 * tick see accurate recency regardless of whether the flush has run yet.
 */
export async function getCacheEntry(
  channelId: string,
  now: number = Date.now(),
): Promise<CacheEntry | undefined> {
  const store = await readStore();
  const entry = store[channelId];
  if (!entry || entry.expiresAt <= now) return undefined;

  pendingAccessTimes.set(channelId, now);
  scheduleRecencyFlush();

  return { ...entry, lastAccessedAt: now };
}

/**
 * Inserts/overwrites the cache entry for `channelId`, then prunes down to
 * `CACHE_LRU_CAP` entries by evicting the least-recently-accessed ones first.
 * Folds in any pending recency bumps (see batched-writes note above) before
 * evicting, so a just-touched entry is correctly protected from eviction even
 * though its bump hadn't been separately flushed yet.
 */
export async function setCacheEntry(
  channelId: string,
  data: ErrorEntry | SuccessEntry,
  ttlMs: number,
  now: number = Date.now(),
): Promise<void> {
  const pending = pendingAccessTimes;
  pendingAccessTimes = new Map();
  cancelScheduledFlush();

  const store = await readStore();
  for (const [id, accessedAt] of pending) {
    const entry = store[id];
    if (entry && accessedAt > entry.lastAccessedAt) entry.lastAccessedAt = accessedAt;
  }

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
