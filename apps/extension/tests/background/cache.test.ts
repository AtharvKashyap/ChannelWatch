import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../mocks/chrome.js";
import {
  CACHE_LRU_CAP,
  cacheSize,
  getCacheEntry,
  setCacheEntry,
} from "../../src/background/cache.js";
import { researchedFixture } from "../fixtures.js";

beforeEach(() => {
  installChromeMock();
});

describe("cache TTL expiry", () => {
  it("returns a fresh entry", async () => {
    const payload = researchedFixture();
    await setCacheEntry("UC_fresh", { kind: "success", payload }, 60_000, 1_000);

    const entry = await getCacheEntry("UC_fresh", 1_500);
    expect(entry).toBeDefined();
    expect(entry?.data).toEqual({ kind: "success", payload });
  });

  it("treats an expired entry as a miss", async () => {
    const payload = researchedFixture();
    await setCacheEntry("UC_stale", { kind: "success", payload }, 1_000, 1_000);

    const entry = await getCacheEntry("UC_stale", 5_000);
    expect(entry).toBeUndefined();
  });

  it("returns undefined for a channel never cached", async () => {
    expect(await getCacheEntry("UC_never")).toBeUndefined();
  });

  it("bumps lastAccessedAt on a hit", async () => {
    const payload = researchedFixture();
    await setCacheEntry("UC_touch", { kind: "success", payload }, 60_000, 1_000);

    await getCacheEntry("UC_touch", 2_000);
    const store = (await installedLocalDump())["cw_channel_cache_v1"] as Record<
      string,
      { lastAccessedAt: number }
    >;
    expect(store["UC_touch"]?.lastAccessedAt).toBe(2_000);
  });
});

describe("cache LRU cap", () => {
  it("prunes to CACHE_LRU_CAP entries, evicting least-recently-accessed first", async () => {
    const payload = researchedFixture();

    // Fill to the cap.
    for (let i = 0; i < CACHE_LRU_CAP; i++) {
      await setCacheEntry(`UC_${i}`, { kind: "success", payload }, 60_000, i);
    }
    expect(await cacheSize()).toBe(CACHE_LRU_CAP);

    // Touch entry 0 so it is no longer the least-recently-accessed.
    await getCacheEntry("UC_0", CACHE_LRU_CAP + 100);

    // One more insert should push the store over the cap and trigger eviction
    // of the least-recently-accessed entry, which is now UC_1 (accessed at
    // time 1), not UC_0 (just touched at CACHE_LRU_CAP + 100).
    await setCacheEntry("UC_new", { kind: "success", payload }, 60_000, CACHE_LRU_CAP + 200);

    expect(await cacheSize()).toBe(CACHE_LRU_CAP);
    expect(await getCacheEntry("UC_0", CACHE_LRU_CAP + 300)).toBeDefined();
    expect(await getCacheEntry("UC_1", CACHE_LRU_CAP + 300)).toBeUndefined();
    expect(await getCacheEntry("UC_new", CACHE_LRU_CAP + 300)).toBeDefined();
  });
});

// Helper to peek at the raw mocked storage without re-installing the mock.
async function installedLocalDump(): Promise<Record<string, unknown>> {
  const chromeGlobal = (
    globalThis as { chrome: { storage: { local: { get: () => Promise<unknown> } } } }
  ).chrome;
  return (await chromeGlobal.storage.local.get()) as Record<string, unknown>;
}
