import { describe, it, expect } from "vitest";
import {
  ENTITY_TYPES,
  RELATIONSHIP_TYPES,
  EVIDENCE_STATUSES,
  CLAIM_STATUSES,
  CONFIDENCE_LABELS,
  CLASSIFICATION_LABELS,
  BADGE_COLORS,
  SOURCE_TIERS,
  RESEARCH_STATUSES,
  CONTROL_LEVELS,
  CREATOR_STATUSES,
  EntityTypeSchema,
  RelationshipTypeSchema,
  BadgeColorSchema,
} from "../src/enums.js";

describe("enums match SPEC lists exactly", () => {
  it("EntityType (§15.1) — 14 node types in order", () => {
    expect(ENTITY_TYPES).toEqual([
      "CHANNEL",
      "CREATOR",
      "PERSON",
      "COMPANY",
      "SUBSIDIARY",
      "MEDIA_NETWORK",
      "INVESTMENT_FIRM",
      "PRIVATE_EQUITY_FIRM",
      "VENTURE_CAPITAL_FIRM",
      "FUND",
      "BRAND",
      "TRUST",
      "NONPROFIT",
      "UNKNOWN_ENTITY",
    ]);
    expect(ENTITY_TYPES).toHaveLength(14);
  });

  it("RelationshipType (§15.2) — 20 values in order", () => {
    expect(RELATIONSHIP_TYPES).toEqual([
      "OWNS",
      "PARTIALLY_OWNS",
      "CONTROLS",
      "OPERATES",
      "MANAGES",
      "FUNDS",
      "INVESTED_IN",
      "ACQUIRED",
      "MERGED_WITH",
      "LICENSES_FROM",
      "REPRESENTS",
      "FOUNDED_BY",
      "HOSTED_BY",
      "EMPLOYS",
      "SUBSIDIARY_OF",
      "PORTFOLIO_COMPANY_OF",
      "CREATIVE_CONTROL_BY",
      "DISTRIBUTED_BY",
      "AD_SALES_BY",
      "FORMERLY_OWNED_BY",
    ]);
    expect(RELATIONSHIP_TYPES).toHaveLength(20);
  });

  it("EvidenceStatus (§8.2)", () => {
    expect(EVIDENCE_STATUSES).toEqual([
      "ACTIVE",
      "SUPERSEDED",
      "RETRACTED",
      "DISPUTED",
      "ARCHIVED",
      "BROKEN_LINK",
      "PENDING_REVIEW",
    ]);
  });

  it("ClaimStatus (§8.3)", () => {
    expect(CLAIM_STATUSES).toEqual([
      "DRAFT",
      "UNDER_REVIEW",
      "PUBLISHED",
      "DISPUTED",
      "CORRECTED",
      "RETRACTED",
      "ARCHIVED",
    ]);
  });

  it("ConfidenceLabel (§8.1)", () => {
    expect(CONFIDENCE_LABELS).toEqual([
      "CONFIRMED",
      "HIGH",
      "MODERATE",
      "LOW",
      "DISPUTED",
      "UNKNOWN",
    ]);
  });

  it("ClassificationLabel (§9.1 codes)", () => {
    expect(CLASSIFICATION_LABELS).toEqual([
      "INDEPENDENT",
      "CREATOR_OWNED",
      "EXTERNALLY_FUNDED",
      "CORPORATE_OWNED",
      "PE_BACKED",
      "OWNERSHIP_CHANGED",
      "OWNERSHIP_UNCLEAR",
      "DISPUTED",
    ]);
  });

  it("BadgeColor (§9.2)", () => {
    expect(BADGE_COLORS).toEqual(["NEUTRAL", "GREEN", "BLUE", "PURPLE", "ORANGE", "RED"]);
  });

  it("SourceTier (1|2|3|4)", () => {
    expect(SOURCE_TIERS).toEqual([1, 2, 3, 4]);
  });

  it("ResearchStatus (§20.1) — 10 values in order", () => {
    expect(RESEARCH_STATUSES).toEqual([
      "UNRESEARCHED",
      "DISCOVERY_RUNNING",
      "CANDIDATES_FOUND",
      "NEEDS_REVIEW",
      "RESEARCH_INCOMPLETE",
      "APPROVED",
      "PUBLISHED",
      "DISPUTED",
      "RECHECK_REQUIRED",
      "ARCHIVED",
    ]);
    expect(RESEARCH_STATUSES).toHaveLength(10);
  });

  it("ControlLevel", () => {
    expect(CONTROL_LEVELS).toEqual(["CONTROLLING", "MINORITY", "MANAGEMENT", "LICENSE", "UNKNOWN"]);
  });

  it("CreatorStatus (§6.5 codes)", () => {
    expect(CREATOR_STATUSES).toEqual([
      "OWNER_OPERATOR",
      "OWNER_EXTERNAL_MGMT",
      "MAJORITY_OWNER",
      "MINORITY_OWNER",
      "HOST_NOT_IN_CONTROL",
      "REMAINS_HOST",
      "EXITED",
      "UNCLEAR",
      "CORPORATE_BRAND",
    ]);
  });
});

describe("Zod enums accept/reject", () => {
  it("EntityTypeSchema accepts members and rejects non-members", () => {
    expect(EntityTypeSchema.parse("PRIVATE_EQUITY_FIRM")).toBe("PRIVATE_EQUITY_FIRM");
    expect(() => EntityTypeSchema.parse("BANK")).toThrow();
  });

  it("RelationshipTypeSchema accepts members", () => {
    expect(RelationshipTypeSchema.parse("PORTFOLIO_COMPANY_OF")).toBe("PORTFOLIO_COMPANY_OF");
  });

  it("BadgeColorSchema rejects lowercase", () => {
    expect(() => BadgeColorSchema.parse("green")).toThrow();
  });
});
