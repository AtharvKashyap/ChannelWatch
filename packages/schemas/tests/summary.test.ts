import { describe, it, expect } from "vitest";
import {
  classificationSummary,
  CORRECTION_RECEIVED,
  RESEARCH_LEAD_RECEIVED,
  UNRESEARCHED_SUMMARY,
} from "../src/copy.js";
import { CLASSIFICATION_LABELS } from "../src/enums.js";

/**
 * Tests for the lookup-summary builder. It is the single source of the
 * `classification.summary` sentence, so it must (a) compose the §23.1 safer
 * language for every label, and (b) never emit banned/loaded phrasing.
 */

describe("classificationSummary (§23.1 safer language)", () => {
  it("composes the PE-backed chain as owner + portfolio company of parent", () => {
    const s = classificationSummary({
      label: "PE_BACKED",
      channelName: "Little Baby Bum",
      directOwnerName: "Moonbug Entertainment",
      ultimateParentName: "Blackstone",
    });
    expect(s).toBe(
      "Public records indicate that Moonbug Entertainment owns Little Baby Bum. " +
        "Moonbug Entertainment is a portfolio company of Blackstone.",
    );
  });

  it("falls back to a plain ownership sentence when parent equals owner", () => {
    const s = classificationSummary({
      label: "PE_BACKED",
      channelName: "Chan",
      directOwnerName: "Acme PE",
      ultimateParentName: "Acme PE",
    });
    expect(s).toBe("Public records indicate that Acme PE owns Chan.");
  });

  it("does not double a period when an entity name already ends in one", () => {
    const s = classificationSummary({
      label: "PE_BACKED",
      channelName: "Little Baby Bum",
      directOwnerName: "Moonbug Entertainment",
      ultimateParentName: "Blackstone Inc.",
    });
    expect(s).not.toContain("..");
    expect(s.endsWith("portfolio company of Blackstone Inc.")).toBe(true);
  });

  it("describes corporate ownership with a subsidiary parent", () => {
    const s = classificationSummary({
      label: "CORPORATE_OWNED",
      channelName: "Chan",
      directOwnerName: "Studio LLC",
      ultimateParentName: "MegaCorp",
    });
    expect(s).toContain("Studio LLC owns Chan");
    expect(s).toContain("subsidiary of MegaCorp");
  });

  it("names the creator-owner when present", () => {
    expect(
      classificationSummary({
        label: "CREATOR_OWNED",
        channelName: "Chan",
        directOwnerName: "Jane Creator",
      }),
    ).toBe("Public records indicate that Jane Creator owns Chan.");
  });

  it("stays neutral when ownership is unclear", () => {
    expect(classificationSummary({ label: "OWNERSHIP_UNCLEAR", channelName: "Chan" })).toBe(
      "Public sources do not clearly establish who owns Chan.",
    );
  });

  it("returns a non-empty sentence for every classification label", () => {
    for (const label of CLASSIFICATION_LABELS) {
      const s = classificationSummary({
        label,
        channelName: "Chan",
        directOwnerName: "Owner Co",
        ultimateParentName: "Parent Co",
      });
      expect(s.length).toBeGreaterThan(0);
      expect(s).toContain("Chan");
    }
  });

  it("never emits banned/loaded phrasing for any label", () => {
    const banned = [
      /sold out/i,
      /no longer has any control/i,
      /controls editorial/i,
      /lost control/i,
    ];
    for (const label of CLASSIFICATION_LABELS) {
      const withOwner = classificationSummary({
        label,
        channelName: "Chan",
        directOwnerName: "Owner Co",
        ultimateParentName: "Parent Co",
      });
      const bare = classificationSummary({ label, channelName: "Chan" });
      for (const pattern of banned) {
        expect(withOwner).not.toMatch(pattern);
        expect(bare).not.toMatch(pattern);
      }
    }
  });

  it("exposes a neutral unresearched summary constant", () => {
    expect(UNRESEARCHED_SUMMARY).toBe("This channel has not yet been researched.");
  });

  it("exposes the POST intake acknowledgement strings", () => {
    expect(CORRECTION_RECEIVED).toBe("Correction received and queued for review.");
    expect(RESEARCH_LEAD_RECEIVED).toBe("Research lead received and queued for review.");
  });
});
