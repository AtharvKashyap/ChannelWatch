import { describe, it, expect } from "vitest";
import { SOURCE_TYPES } from "@channelwatch/schemas";
import { EVIDENCE_WEIGHTS, SOURCE_TYPE_TIERS } from "../src/weights.js";

describe("EVIDENCE_WEIGHTS (SPEC §14.1)", () => {
  it("matches the §14.1 table verbatim, keyed by every SourceType", () => {
    expect(EVIDENCE_WEIGHTS).toEqual({
      OFFICIAL_REGULATORY_FILING: 1.0,
      OFFICIAL_ACQUISITION_ANNOUNCEMENT: 0.95,
      INVESTOR_PORTFOLIO_LISTING: 0.9,
      DIRECT_CREATOR_CONFIRMATION: 0.9,
      CORPORATE_REGISTRY_RECORD: 0.9,
      REPUTABLE_BUSINESS_PUBLICATION: 0.8,
      ESTABLISHED_INDUSTRY_PUBLICATION: 0.75,
      NAMED_EXECUTIVE_INTERVIEW: 0.75,
      ARCHIVED_CORPORATE_PAGE: 0.65,
      TRADEMARK_TRANSFER: 0.65,
      SHARED_LEGAL_DOCUMENTATION: 0.6,
      TECHNICAL_INFRASTRUCTURE_LINKAGE: 0.35,
      ANONYMOUS_TIP: 0.1,
      BEHAVIORAL_CONTENT_CHANGE: 0.05,
    });
  });

  it("has an entry for every SourceType and no extras", () => {
    expect(Object.keys(EVIDENCE_WEIGHTS).sort()).toEqual([...SOURCE_TYPES].sort());
  });
});

describe("SOURCE_TYPE_TIERS (SPEC §14.1 / §7.1)", () => {
  it("maps filings through registry records to Tier 1", () => {
    expect(SOURCE_TYPE_TIERS.OFFICIAL_REGULATORY_FILING).toBe(1);
    expect(SOURCE_TYPE_TIERS.OFFICIAL_ACQUISITION_ANNOUNCEMENT).toBe(1);
    expect(SOURCE_TYPE_TIERS.INVESTOR_PORTFOLIO_LISTING).toBe(1);
    expect(SOURCE_TYPE_TIERS.DIRECT_CREATOR_CONFIRMATION).toBe(1);
    expect(SOURCE_TYPE_TIERS.CORPORATE_REGISTRY_RECORD).toBe(1);
  });

  it("maps publications and named interviews to Tier 2", () => {
    expect(SOURCE_TYPE_TIERS.REPUTABLE_BUSINESS_PUBLICATION).toBe(2);
    expect(SOURCE_TYPE_TIERS.ESTABLISHED_INDUSTRY_PUBLICATION).toBe(2);
    expect(SOURCE_TYPE_TIERS.NAMED_EXECUTIVE_INTERVIEW).toBe(2);
  });

  it("maps archived pages through technical infrastructure to Tier 3", () => {
    expect(SOURCE_TYPE_TIERS.ARCHIVED_CORPORATE_PAGE).toBe(3);
    expect(SOURCE_TYPE_TIERS.TRADEMARK_TRANSFER).toBe(3);
    expect(SOURCE_TYPE_TIERS.SHARED_LEGAL_DOCUMENTATION).toBe(3);
    expect(SOURCE_TYPE_TIERS.TECHNICAL_INFRASTRUCTURE_LINKAGE).toBe(3);
  });

  it("maps tips and behavioral signals to Tier 4", () => {
    expect(SOURCE_TYPE_TIERS.ANONYMOUS_TIP).toBe(4);
    expect(SOURCE_TYPE_TIERS.BEHAVIORAL_CONTENT_CHANGE).toBe(4);
  });

  it("has an entry for every SourceType and no extras", () => {
    expect(Object.keys(SOURCE_TYPE_TIERS).sort()).toEqual([...SOURCE_TYPES].sort());
  });
});
