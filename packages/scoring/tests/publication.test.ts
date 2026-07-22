import { describe, it, expect } from "vitest";
import { isPublishable, canPublishPeLabel } from "../src/publication.js";

describe("isPublishable (SPEC §14.3 publication threshold)", () => {
  it("is publishable at exactly the 0.30 threshold", () => {
    expect(isPublishable(0.3)).toBe(true);
  });

  it("is not publishable at 0.299, just below the threshold", () => {
    expect(isPublishable(0.299)).toBe(false);
  });

  it("is publishable above the threshold", () => {
    expect(isPublishable(0.884)).toBe(true);
  });

  it("is not publishable at 0", () => {
    expect(isPublishable(0)).toBe(false);
  });
});

describe("canPublishPeLabel (SPEC §14.3 PE-label rule)", () => {
  it("allows a single Tier 1 source", () => {
    expect(canPublishPeLabel([{ tier: 1, publisher: "sec.gov" }])).toBe(true);
  });

  it("does not allow two Tier 2 sources from the same publisher", () => {
    expect(
      canPublishPeLabel([
        { tier: 2, publisher: "Forbes" },
        { tier: 2, publisher: "Forbes" },
      ]),
    ).toBe(false);
  });

  it("allows two Tier 2 sources from independent publishers", () => {
    expect(
      canPublishPeLabel([
        { tier: 2, publisher: "Forbes" },
        { tier: 2, publisher: "Bloomberg" },
      ]),
    ).toBe(true);
  });

  it("does not allow a single Tier 2 source", () => {
    expect(canPublishPeLabel([{ tier: 2, publisher: "Forbes" }])).toBe(false);
  });

  it("never allows Tier 3 sources alone, however many", () => {
    expect(
      canPublishPeLabel([
        { tier: 3, publisher: "A" },
        { tier: 3, publisher: "B" },
        { tier: 3, publisher: "C" },
      ]),
    ).toBe(false);
  });

  it("never allows Tier 4 sources alone, however many", () => {
    expect(
      canPublishPeLabel([
        { tier: 4, publisher: "A" },
        { tier: 4, publisher: "B" },
      ]),
    ).toBe(false);
  });

  it("returns false for an empty source list", () => {
    expect(canPublishPeLabel([])).toBe(false);
  });

  it("allows a Tier 1 source alongside unrelated lower-tier sources", () => {
    expect(
      canPublishPeLabel([
        { tier: 4, publisher: "A" },
        { tier: 1, publisher: "sec.gov" },
      ]),
    ).toBe(true);
  });

  it("normalizes publisher casing/whitespace: 'Forbes' and ' forbes ' are the same publisher", () => {
    expect(
      canPublishPeLabel([
        { tier: 2, publisher: "Forbes" },
        { tier: 2, publisher: " forbes " },
      ]),
    ).toBe(false);
  });

  it("still allows two genuinely independent Tier 2 publishers after normalization", () => {
    expect(
      canPublishPeLabel([
        { tier: 2, publisher: " Forbes " },
        { tier: 2, publisher: "BLOOMBERG" },
      ]),
    ).toBe(true);
  });
});
