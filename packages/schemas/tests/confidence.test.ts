import { describe, it, expect } from "vitest";
import { confidenceLabelFromScore, PUBLICATION_THRESHOLD, CACHE_TTLS } from "../src/confidence.js";

describe("confidenceLabelFromScore (§14.3 bands)", () => {
  it("band edges", () => {
    expect(confidenceLabelFromScore(1.0)).toBe("CONFIRMED");
    expect(confidenceLabelFromScore(0.9)).toBe("CONFIRMED");
    expect(confidenceLabelFromScore(0.89)).toBe("HIGH");
    expect(confidenceLabelFromScore(0.75)).toBe("HIGH");
    expect(confidenceLabelFromScore(0.74)).toBe("MODERATE");
    expect(confidenceLabelFromScore(0.55)).toBe("MODERATE");
    expect(confidenceLabelFromScore(0.54)).toBe("LOW");
    expect(confidenceLabelFromScore(0.3)).toBe("LOW");
    expect(confidenceLabelFromScore(0.299)).toBe("UNKNOWN");
    expect(confidenceLabelFromScore(0)).toBe("UNKNOWN");
  });

  it("does not label DISPUTED from a score (DISPUTED is a conflict state, not a band)", () => {
    for (const s of [0, 0.3, 0.55, 0.75, 0.9, 1.0]) {
      expect(confidenceLabelFromScore(s)).not.toBe("DISPUTED");
    }
  });
});

describe("PUBLICATION_THRESHOLD", () => {
  it("is 0.30", () => {
    expect(PUBLICATION_THRESHOLD).toBe(0.3);
  });

  it("scores below threshold are research-lead-only (UNKNOWN)", () => {
    expect(confidenceLabelFromScore(PUBLICATION_THRESHOLD - 0.001)).toBe("UNKNOWN");
    expect(confidenceLabelFromScore(PUBLICATION_THRESHOLD)).toBe("LOW");
  });
});

describe("CACHE_TTLS (§18.6, milliseconds)", () => {
  it("matches spec durations", () => {
    expect(CACHE_TTLS.confirmed).toBe(7 * 24 * 60 * 60 * 1000);
    expect(CACHE_TTLS.recentlyChanged).toBe(6 * 60 * 60 * 1000);
    expect(CACHE_TTLS.unknown).toBe(24 * 60 * 60 * 1000);
    expect(CACHE_TTLS.apiError).toBe(10 * 60 * 1000);
    expect(CACHE_TTLS.disputed).toBe(60 * 60 * 1000);
  });
});
