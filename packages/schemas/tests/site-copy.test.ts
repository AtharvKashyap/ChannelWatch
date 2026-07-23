import { describe, it, expect } from "vitest";
import { SITE_COPY, CORRECTION_PAGE_COPY, METHODOLOGY_COPY } from "../src/copy.js";

/**
 * The public-site copy (M3 Track C) is user-facing prose, so it must never emit
 * banned/loaded phrasing (§23.1) and every string must be non-empty.
 */

const banned = [
  /sold out/i,
  /no longer has any control/i,
  /controls editorial/i,
  /lost control/i,
  /secretly control/i,
];

function flatten(value: unknown, out: string[]): void {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) flatten(v, out);
  else if (value && typeof value === "object")
    for (const v of Object.values(value)) flatten(v, out);
}

function allStrings(): string[] {
  const out: string[] = [];
  flatten(SITE_COPY, out);
  flatten(CORRECTION_PAGE_COPY, out);
  flatten(METHODOLOGY_COPY, out);
  return out;
}

describe("public-site copy is non-empty and §23.1-safe", () => {
  it("every string is non-empty", () => {
    for (const s of allStrings()) expect(s.trim().length).toBeGreaterThan(0);
  });

  it("contains no banned phrases", () => {
    for (const s of allStrings()) {
      for (const pattern of banned) expect(s).not.toMatch(pattern);
    }
  });
});

describe("SITE_COPY shape", () => {
  it("exposes the home blurb and the section headings the site renders", () => {
    expect(SITE_COPY.homeBlurb.length).toBeGreaterThanOrEqual(1);
    expect(SITE_COPY.overviewHeading.length).toBeGreaterThan(0);
    expect(SITE_COPY.evidenceHeading).toBe("Evidence");
    expect(SITE_COPY.timelineHeading).toBe("Timeline");
    expect(SITE_COPY.unresearchedHeading).toBe("Not yet researched");
  });
});

describe("METHODOLOGY_COPY faithfully mirrors docs/METHODOLOGY.md", () => {
  it("has four evidence tiers, six confidence levels, five threshold bands", () => {
    expect(METHODOLOGY_COPY.evidenceTiers).toHaveLength(4);
    expect(METHODOLOGY_COPY.confidenceLevels).toHaveLength(6);
    expect(METHODOLOGY_COPY.thresholds).toHaveLength(5);
  });

  it("keeps the Tier 4 leads-only rule and the PE = orange (never red) rule", () => {
    expect(METHODOLOGY_COPY.evidenceTiers[3]?.description).toMatch(/never independently support/i);
    expect(METHODOLOGY_COPY.peRule).toMatch(/orange/i);
    expect(METHODOLOGY_COPY.peRule).toMatch(/never a red badge/i);
  });

  it("keeps the LLMs-draft-humans-publish rule", () => {
    expect(METHODOLOGY_COPY.llm).toMatch(/humans publish/i);
  });
});
