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

// LEGAL_PAGE_COPY (M3 Track F) is user-facing prose on /legal — same §23.1 bar.
import { LEGAL_PAGE_COPY } from "../src/copy.js";

describe("LEGAL_PAGE_COPY", () => {
  const strings: string[] = [];
  flatten(LEGAL_PAGE_COPY, strings);

  it("every string is non-empty", () => {
    for (const s of strings) expect(s.trim().length).toBeGreaterThan(0);
  });

  it("no banned §23.1 phrasing", () => {
    for (const s of strings) for (const b of banned) expect(s).not.toMatch(b);
  });

  it("the designated-agent contact is still the NEEDS-HUMAN placeholder or a real contact (never empty)", () => {
    expect(LEGAL_PAGE_COPY.agentContact.length).toBeGreaterThan(10);
  });
});

// PRIVACY_PAGE_COPY (M3 Track F) is the public /privacy page (the Chrome Web
// Store's required privacy-policy URL) — user-facing prose on the same §23.1 bar.
import { PRIVACY_PAGE_COPY } from "../src/copy.js";

describe("PRIVACY_PAGE_COPY", () => {
  const strings: string[] = [];
  flatten(PRIVACY_PAGE_COPY, strings);

  it("every string is non-empty", () => {
    for (const s of strings) expect(s.trim().length).toBeGreaterThan(0);
  });

  it("no banned §23.1 phrasing", () => {
    for (const s of strings) for (const b of banned) expect(s).not.toMatch(b);
  });

  it("faithfully carries the substance of PRIVACY.md", () => {
    // The three request-payload fields the extension sends (Spec §22.2).
    expect(PRIVACY_PAGE_COPY.sends).toHaveLength(3);
    // The core promise: no persisted user data, telemetry strictly opt-in.
    expect(PRIVACY_PAGE_COPY.storageNote).toMatch(/no user data/i);
    expect(PRIVACY_PAGE_COPY.telemetryIntro).toMatch(/opt-in/i);
    expect(PRIVACY_PAGE_COPY.telemetryNote).toMatch(/never includes/i);
    // Non-empty nav label so the site can link the page.
    expect(PRIVACY_PAGE_COPY.navPrivacy.length).toBeGreaterThan(0);
  });
});
