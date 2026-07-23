import { describe, it, expect } from "vitest";
import {
  BADGE_LABELS,
  BADGE_NAME_MAX_LENGTH,
  badgeText,
  badgeAriaLabel,
  truncateName,
  ownershipMechanismText,
  ownershipStakeText,
  CHAIN_COPY,
} from "../src/copy.js";
import { CLASSIFICATION_LABELS, RELATIONSHIP_TYPES, CONTROL_LEVELS } from "../src/enums.js";

/**
 * Tests for the ownership-chain + named-badge copy (M3 task 2). All of these are
 * user-facing strings, so they must (a) compose from the reviewed primitives and
 * (b) never emit banned/loaded phrasing (§23.1).
 */

describe("truncateName", () => {
  it("leaves short names untouched", () => {
    expect(truncateName("Blackstone")).toBe("Blackstone");
  });
  it("truncates names longer than the cap with an ellipsis", () => {
    const long = "The Very Long Holding Company International Group";
    const out = truncateName(long);
    expect(out.length).toBeLessThanOrEqual(BADGE_NAME_MAX_LENGTH);
    expect(out.endsWith("…")).toBe(true);
  });
  it("keeps a name exactly at the cap intact", () => {
    const exact = "x".repeat(BADGE_NAME_MAX_LENGTH);
    expect(truncateName(exact)).toBe(exact);
  });
});

describe("badgeText — named badges per label", () => {
  it("appends the ultimate PE firm name for PE_BACKED", () => {
    expect(badgeText("PE_BACKED", "Blackstone")).toBe("PE-Backed · Blackstone");
  });
  it("appends the direct owner name for CORPORATE_OWNED", () => {
    expect(badgeText("CORPORATE_OWNED", "MegaCorp")).toBe("Corporate-Owned · MegaCorp");
  });
  it("appends the direct owner name for NONPROFIT_OWNED", () => {
    expect(badgeText("NONPROFIT_OWNED", "Complexly")).toBe("Nonprofit-Owned · Complexly");
  });
  it("does NOT append a name for CREATOR_OWNED", () => {
    expect(badgeText("CREATOR_OWNED", "Jane Creator")).toBe(BADGE_LABELS.CREATOR_OWNED);
  });
  it("does NOT append a name for DISPUTED / OWNERSHIP_UNCLEAR", () => {
    expect(badgeText("DISPUTED", "Whoever")).toBe(BADGE_LABELS.DISPUTED);
    expect(badgeText("OWNERSHIP_UNCLEAR", "Whoever")).toBe(BADGE_LABELS.OWNERSHIP_UNCLEAR);
  });
  it("falls back to the plain label when no name is supplied", () => {
    expect(badgeText("PE_BACKED")).toBe(BADGE_LABELS.PE_BACKED);
    expect(badgeText("PE_BACKED", null)).toBe(BADGE_LABELS.PE_BACKED);
    expect(badgeText("PE_BACKED", "")).toBe(BADGE_LABELS.PE_BACKED);
  });
  it("truncates the name inside the chip", () => {
    const long = "The Very Long Holding Company International Group";
    const out = badgeText("PE_BACKED", long);
    expect(out.startsWith("PE-Backed · ")).toBe(true);
    expect(out.endsWith("…")).toBe(true);
  });
  it("returns a non-empty string for every label", () => {
    for (const label of CLASSIFICATION_LABELS) {
      expect(badgeText(label, "Owner Co").length).toBeGreaterThan(0);
      expect(badgeText(label).length).toBeGreaterThan(0);
    }
  });
});

describe("badgeAriaLabel — name-aware", () => {
  it("announces the operative name in full (untruncated) for named labels", () => {
    const long = "The Very Long Holding Company International Group";
    const aria = badgeAriaLabel("PE_BACKED", long);
    expect(aria).toContain(long); // full, not truncated
    expect(aria).toContain("Ownership:");
  });
  it("omits the name for non-suffixed labels", () => {
    expect(badgeAriaLabel("CREATOR_OWNED", "Jane")).toBe(badgeAriaLabel("CREATOR_OWNED"));
  });
  it("stays backward-compatible when no name is passed", () => {
    for (const label of CLASSIFICATION_LABELS) {
      const aria = badgeAriaLabel(label);
      expect(aria).toContain(BADGE_LABELS[label]);
      expect(aria.length).toBeGreaterThan(BADGE_LABELS[label].length);
    }
  });
});

describe("ownershipMechanismText — neutral, data-driven", () => {
  it("maps the LBB-chain relationship types to structural phrases", () => {
    expect(ownershipMechanismText("ACQUIRED", "CONTROLLING")).toBe("acquired");
    expect(ownershipMechanismText("SUBSIDIARY_OF", "UNKNOWN")).toBe("subsidiary of");
    expect(ownershipMechanismText("PORTFOLIO_COMPANY_OF", "UNKNOWN")).toBe("portfolio company of");
  });
  it("distinguishes controlling vs minority stakes", () => {
    expect(ownershipMechanismText("OWNS", "CONTROLLING")).toBe("controlling stake");
    expect(ownershipMechanismText("PARTIALLY_OWNS", "CONTROLLING")).toBe("majority investment");
    expect(ownershipMechanismText("PARTIALLY_OWNS", "MINORITY")).toBe("minority investment");
    expect(ownershipMechanismText("CONTROLS", "UNKNOWN")).toBe("controlling stake");
  });
  it("returns a non-empty phrase for every relationship/control combination", () => {
    for (const rel of RELATIONSHIP_TYPES) {
      for (const cl of CONTROL_LEVELS) {
        expect(ownershipMechanismText(rel, cl).length).toBeGreaterThan(0);
      }
    }
  });
});

describe("ownershipStakeText", () => {
  it("shows the exact percentage when disclosed", () => {
    expect(ownershipStakeText(75)).toBe("75% stake");
  });
  it("uses the neutral not-disclosed line when the percentage is null", () => {
    expect(ownershipStakeText(null)).toBe("stake not publicly disclosed");
  });
});

describe("CHAIN_COPY — temporal ownership history additions (Track A)", () => {
  it("exposes the history section heading and period markers", () => {
    expect(CHAIN_COPY.historyHeading).toBe("Ownership over time");
    expect(CHAIN_COPY.previouslyPrefix).toBe("previously");
    expect(CHAIN_COPY.currentLabel).toBe("current");
    expect(CHAIN_COPY.dateRangeSeparator).toBe("–");
    expect(CHAIN_COPY.dateUndisclosed).toBe("date not publicly disclosed");
  });
  it("keeps every history string non-empty", () => {
    for (const value of Object.values(CHAIN_COPY)) {
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe("banned language (§23.1) across chain + badge copy", () => {
  const banned = [
    /sold out/i,
    /no longer has any control/i,
    /controls editorial/i,
    /lost control/i,
  ];

  function collectStrings(): string[] {
    const out: string[] = [...Object.values(CHAIN_COPY)];
    for (const label of CLASSIFICATION_LABELS) {
      out.push(badgeText(label, "Some Owner Name"), badgeAriaLabel(label, "Some Owner Name"));
    }
    for (const rel of RELATIONSHIP_TYPES) {
      for (const cl of CONTROL_LEVELS) out.push(ownershipMechanismText(rel, cl));
    }
    out.push(ownershipStakeText(50), ownershipStakeText(null));
    return out;
  }

  it("contains no banned phrases", () => {
    for (const s of collectStrings()) {
      for (const pattern of banned) {
        expect(s).not.toMatch(pattern);
      }
    }
  });
});
