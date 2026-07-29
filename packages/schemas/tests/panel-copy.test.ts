import { describe, it, expect } from "vitest";
import {
  CONFIDENCE_LABEL_TEXT,
  EXPLANATION_TEXT,
  CREATOR_STATUS_TEXT,
  PANEL_COPY,
  POPUP_COPY,
  BADGE_LABELS,
  badgeAriaLabel,
  evidenceCountText,
  lastReviewedText,
  EDITORIAL_DISCLAIMER,
  CORRECTION_CTA,
  CORRECTION_RECEIVED,
} from "../src/copy.js";
import {
  CONFIDENCE_LABELS,
  EXPLANATION_CODES,
  CREATOR_STATUSES,
  CLASSIFICATION_LABELS,
} from "../src/enums.js";

describe("confidence label display text", () => {
  it("has non-empty text for every confidence label", () => {
    for (const label of CONFIDENCE_LABELS) {
      expect(typeof CONFIDENCE_LABEL_TEXT[label]).toBe("string");
      expect(CONFIDENCE_LABEL_TEXT[label].length).toBeGreaterThan(0);
    }
  });

  it("maps CONFIRMED to a human label", () => {
    expect(CONFIDENCE_LABEL_TEXT.CONFIRMED).toBe("Confirmed");
  });
});

describe("explanation / warning code text (§9.4, §26.2)", () => {
  it("has non-empty text for every explanation code", () => {
    for (const code of EXPLANATION_CODES) {
      expect(typeof EXPLANATION_TEXT[code]).toBe("string");
      expect(EXPLANATION_TEXT[code].length).toBeGreaterThan(0);
    }
  });

  it("surfaces the recent-change warning neutrally", () => {
    expect(EXPLANATION_TEXT.OWNERSHIP_CHANGED_RECENTLY).toContain("changed recently");
  });

  it("surfaces the outdated-record warning", () => {
    expect(EXPLANATION_TEXT.RECORD_OUTDATED).toContain("out of date");
  });
});

describe("creator involvement display text (§6.5)", () => {
  it("has non-empty text for every creator status", () => {
    for (const status of CREATOR_STATUSES) {
      expect(typeof CREATOR_STATUS_TEXT[status]).toBe("string");
      expect(CREATOR_STATUS_TEXT[status].length).toBeGreaterThan(0);
    }
  });
});

describe("evidenceCountText", () => {
  it("reads as no sources when zero", () => {
    expect(evidenceCountText(0)).toBe("No sources reviewed");
  });
  it("is singular for one", () => {
    expect(evidenceCountText(1)).toBe("1 source reviewed");
  });
  it("is plural for many", () => {
    expect(evidenceCountText(4)).toBe("4 sources reviewed");
  });
});

describe("lastReviewedText", () => {
  it("states never reviewed for null", () => {
    expect(lastReviewedText(null)).toBe(PANEL_COPY.neverReviewed);
  });
  it("prefixes the reviewed label for a date", () => {
    expect(lastReviewedText("2026-01-01")).toContain("2026-01-01");
    expect(lastReviewedText("2026-01-01")).toContain("Last reviewed");
  });
});

describe("panel copy constants", () => {
  it("exposes the correction-form and section labels the panel needs", () => {
    for (const key of [
      "panelTitle",
      "close",
      "directOwnerLabel",
      "ultimateParentLabel",
      "creatorStatusLabel",
      "confidenceLabel",
      "evidenceLabel",
      "lastReviewedLabel",
      "warningsLabel",
      "neverReviewed",
      "unresearchedHeading",
      "correctionHeading",
      "explanationLabel",
      "explanationPlaceholder",
      "nameLabel",
      "emailLabel",
      "relationshipLabel",
      "submit",
      "submitting",
      "explanationTooShort",
      "submitError",
    ] as const) {
      expect(typeof PANEL_COPY[key]).toBe("string");
      expect(PANEL_COPY[key].length).toBeGreaterThan(0);
    }
  });

  it("uses the reviewed disclaimer and CTA verbatim", () => {
    expect(EDITORIAL_DISCLAIMER).toBe("No conclusion is made about editorial interference.");
    expect(CORRECTION_CTA).toBe("Report an Error");
    expect(CORRECTION_RECEIVED).toBe("Correction received and queued for review.");
  });
});

describe("badgeAriaLabel", () => {
  it("embeds the exact badge label for every classification", () => {
    for (const label of CLASSIFICATION_LABELS) {
      const aria = badgeAriaLabel(label);
      expect(aria).toContain(BADGE_LABELS[label]);
      expect(aria.length).toBeGreaterThan(BADGE_LABELS[label].length);
    }
  });
});

describe("popup copy constants", () => {
  it("exposes non-empty string values for every popup state", () => {
    for (const key of Object.keys(POPUP_COPY) as (keyof typeof POPUP_COPY)[]) {
      expect(typeof POPUP_COPY[key]).toBe("string");
      expect(POPUP_COPY[key].length).toBeGreaterThan(0);
    }
  });
});

describe("banned language (§23.1) across panel copy", () => {
  const banned = [
    /sold out/i,
    /no longer has any control/i,
    /controls editorial/i,
    /lost control/i,
  ];

  function collectStrings(): string[] {
    return [
      ...Object.values(CONFIDENCE_LABEL_TEXT),
      ...Object.values(EXPLANATION_TEXT),
      ...Object.values(CREATOR_STATUS_TEXT),
      ...Object.values(PANEL_COPY),
      ...Object.values(POPUP_COPY),
      ...CLASSIFICATION_LABELS.map((l) => badgeAriaLabel(l)),
      evidenceCountText(3),
      lastReviewedText("2026-01-01"),
    ];
  }

  it("contains no banned phrases", () => {
    for (const s of collectStrings()) {
      for (const pattern of banned) {
        expect(s).not.toMatch(pattern);
      }
    }
  });
});
