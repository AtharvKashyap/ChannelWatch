import { describe, expect, it } from "vitest";
import { CACHE_TTLS } from "@channelwatch/schemas";
import { selectTtlMs } from "../../src/background/ttl.js";
import { researchedFixture, unresearchedFixture } from "../fixtures.js";

describe("selectTtlMs", () => {
  it("caches a confirmed record for 7 days", () => {
    const payload = researchedFixture({
      classification: {
        label: "CORPORATE_OWNED",
        confidence: 0.95,
        confidence_label: "CONFIRMED",
        summary: "Confirmed via SEC filing.",
      },
    });
    expect(selectTtlMs({ kind: "success", payload })).toBe(CACHE_TTLS.confirmed);
  });

  it("caches a disputed record for 1 hour", () => {
    const payload = researchedFixture({ disputed: true });
    expect(selectTtlMs({ kind: "success", payload })).toBe(CACHE_TTLS.disputed);
  });

  it("caches a recently-changed record for 6 hours", () => {
    const payload = researchedFixture({ warnings: ["OWNERSHIP_CHANGED_RECENTLY"] });
    expect(selectTtlMs({ kind: "success", payload })).toBe(CACHE_TTLS.recentlyChanged);
  });

  it("caches an unresearched channel for 24 hours", () => {
    const payload = unresearchedFixture();
    expect(selectTtlMs({ kind: "success", payload })).toBe(CACHE_TTLS.unknown);
  });

  it("caches a researched record with no matching flag for 24 hours (default)", () => {
    const payload = researchedFixture();
    expect(selectTtlMs({ kind: "success", payload })).toBe(CACHE_TTLS.unknown);
  });

  it("caches an API error for 10 minutes", () => {
    expect(selectTtlMs({ kind: "error" })).toBe(CACHE_TTLS.apiError);
  });

  it("takes the shortest TTL when multiple flags apply", () => {
    // Disputed (1h) + confirmed (7d) + recently changed (6h) -> 1h wins.
    const payload = researchedFixture({
      disputed: true,
      warnings: ["OWNERSHIP_CHANGED_RECENTLY"],
      classification: {
        label: "CORPORATE_OWNED",
        confidence: 0.95,
        confidence_label: "CONFIRMED",
        summary: "Confirmed via SEC filing, but under active dispute.",
      },
    });
    expect(selectTtlMs({ kind: "success", payload })).toBe(CACHE_TTLS.disputed);
  });
});
