import { beforeEach, describe, expect, it } from "vitest";
import {
  CACHE_MAX_ENTRIES,
  cacheSize,
  clearCacheForTests,
  getCacheEntry,
  setCacheEntry,
} from "../../src/background/cache.js";
import { researchedFixture } from "../fixtures.js";

beforeEach(() => {
  clearCacheForTests();
});

describe("in-memory session cache", () => {
  it("returns a fresh entry", () => {
    const payload = researchedFixture();
    setCacheEntry("UC_fresh", { kind: "success", payload }, 60_000, 1_000);

    const entry = getCacheEntry("UC_fresh", 1_500);
    expect(entry).toEqual({ kind: "success", payload });
  });

  it("treats an expired entry as a miss and drops it", () => {
    const payload = researchedFixture();
    setCacheEntry("UC_stale", { kind: "success", payload }, 1_000, 1_000);

    expect(getCacheEntry("UC_stale", 5_000)).toBeUndefined();
    // The expired entry is removed on access.
    expect(cacheSize()).toBe(0);
  });

  it("returns undefined for a channel never cached", () => {
    expect(getCacheEntry("UC_never")).toBeUndefined();
  });

  it("caches error outcomes distinctly from success", () => {
    setCacheEntry("UC_err", { kind: "error" }, 10_000, 1_000);
    expect(getCacheEntry("UC_err", 2_000)).toEqual({ kind: "error" });
  });
});

describe("cache memory cap", () => {
  it("prunes to CACHE_MAX_ENTRIES, evicting least-recently-used first", () => {
    const payload = researchedFixture();

    // Fill exactly to the cap, oldest-first.
    for (let i = 0; i < CACHE_MAX_ENTRIES; i++) {
      setCacheEntry(`UC_${i}`, { kind: "success", payload }, 60_000, i);
    }
    expect(cacheSize()).toBe(CACHE_MAX_ENTRIES);

    // Touch UC_0 so it becomes most-recently-used (no longer the eviction victim).
    expect(getCacheEntry("UC_0", CACHE_MAX_ENTRIES + 100)).toBeDefined();

    // One more insert pushes over the cap → the LRU victim is now UC_1, not UC_0.
    setCacheEntry("UC_new", { kind: "success", payload }, 60_000, CACHE_MAX_ENTRIES + 200);

    expect(cacheSize()).toBe(CACHE_MAX_ENTRIES);
    expect(getCacheEntry("UC_0", CACHE_MAX_ENTRIES + 300)).toBeDefined();
    expect(getCacheEntry("UC_1", CACHE_MAX_ENTRIES + 300)).toBeUndefined();
    expect(getCacheEntry("UC_new", CACHE_MAX_ENTRIES + 300)).toBeDefined();
  });
});
