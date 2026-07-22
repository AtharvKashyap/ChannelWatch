import { describe, it, expect } from "vitest";
import * as copy from "../src/copy.js";
import {
  BADGE_LABELS,
  EDITORIAL_DISCLAIMER,
  CORRECTION_CTA,
  ownedBy,
  portfolioCompanyOf,
  undisclosedStake,
} from "../src/copy.js";
import { CLASSIFICATION_LABELS } from "../src/enums.js";

describe("badge display text (§9.1)", () => {
  it("maps each classification label to its exact display string", () => {
    expect(BADGE_LABELS.INDEPENDENT).toBe("Independent");
    expect(BADGE_LABELS.CREATOR_OWNED).toBe("Creator-Owned");
    expect(BADGE_LABELS.EXTERNALLY_FUNDED).toBe("Externally Funded");
    expect(BADGE_LABELS.CORPORATE_OWNED).toBe("Corporate-Owned");
    expect(BADGE_LABELS.NONPROFIT_OWNED).toBe("Nonprofit-Owned");
    expect(BADGE_LABELS.PE_BACKED).toBe("PE-Backed");
    expect(BADGE_LABELS.OWNERSHIP_CHANGED).toBe("Ownership Changed");
    expect(BADGE_LABELS.OWNERSHIP_UNCLEAR).toBe("Ownership Unclear");
    expect(BADGE_LABELS.DISPUTED).toBe("Disputed");
  });

  it("has a label for every classification code", () => {
    for (const label of CLASSIFICATION_LABELS) {
      expect(typeof BADGE_LABELS[label]).toBe("string");
      expect(BADGE_LABELS[label].length).toBeGreaterThan(0);
    }
  });
});

describe("standing disclaimer", () => {
  it("is the exact string", () => {
    expect(EDITORIAL_DISCLAIMER).toBe("No conclusion is made about editorial interference.");
  });
});

describe("correction CTA", () => {
  it('is "Report an Error"', () => {
    expect(CORRECTION_CTA).toBe("Report an Error");
  });
});

describe("neutral summary helpers (§23.1 safer language)", () => {
  it("ownedBy produces a neutral factual sentence", () => {
    expect(ownedBy("Example Channel", "Example Media LLC")).toBe(
      "Public records indicate that Example Media LLC owns Example Channel.",
    );
  });

  it("portfolioCompanyOf describes the structure neutrally", () => {
    const s = portfolioCompanyOf("Example Media", "Example Capital");
    expect(s).toContain("Example Media");
    expect(s).toContain("Example Capital");
    expect(s).toContain("portfolio company");
  });

  it("undisclosedStake avoids asserting loss of control", () => {
    const s = undisclosedStake("the creator");
    expect(s).toContain("not publicly");
  });
});

describe("banned language (§23.1)", () => {
  const banned = [/sold out/i, /no longer has any control/i, /controls editorial/i];

  function collectStrings(): string[] {
    const out: string[] = [];
    out.push(EDITORIAL_DISCLAIMER, CORRECTION_CTA, ...Object.values(BADGE_LABELS));
    out.push(ownedBy("Channel B", "Company A"));
    out.push(portfolioCompanyOf("Company A", "Capital Firm"));
    out.push(undisclosedStake("the creator"));
    return out;
  }

  it("no exported string or helper output contains banned phrases", () => {
    for (const s of collectStrings()) {
      for (const pattern of banned) {
        expect(s).not.toMatch(pattern);
      }
    }
  });

  it("module namespace exposes the expected helpers", () => {
    expect(typeof copy.ownedBy).toBe("function");
    expect(typeof copy.portfolioCompanyOf).toBe("function");
    expect(typeof copy.undisclosedStake).toBe("function");
  });
});
