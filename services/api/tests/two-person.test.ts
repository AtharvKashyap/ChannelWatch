import { describe, it, expect } from "vitest";
import {
  isPeRelated,
  isDisputed,
  involvesNamedIndividual,
  isSensitiveClaim,
  requiredApprovals,
  canPublish,
} from "../src/reviewer/two-person.js";

/**
 * Unit tests for the pure two-person review policy (§20.3). No DB, no HTTP.
 */
describe("two-person review policy (§20.3)", () => {
  const base = { predicate: "OWNED_BY", claimStatus: "UNDER_REVIEW", involvedEntityTypes: [] };

  it("flags a PORTFOLIO_COMPANY_OF predicate as PE-related", () => {
    expect(isPeRelated({ ...base, predicate: "PORTFOLIO_COMPANY_OF" })).toBe(true);
  });

  it("flags a participating PE / investment / VC / fund entity as PE-related", () => {
    expect(isPeRelated({ ...base, involvedEntityTypes: ["COMPANY", "PRIVATE_EQUITY_FIRM"] })).toBe(
      true,
    );
    expect(isPeRelated({ ...base, involvedEntityTypes: ["INVESTMENT_FIRM"] })).toBe(true);
    expect(isPeRelated({ ...base, involvedEntityTypes: ["VENTURE_CAPITAL_FIRM"] })).toBe(true);
    expect(isPeRelated({ ...base, involvedEntityTypes: ["FUND"] })).toBe(true);
  });

  it("does not flag an ordinary corporate-owner claim as PE-related", () => {
    expect(isPeRelated({ ...base, involvedEntityTypes: ["COMPANY", "MEDIA_NETWORK"] })).toBe(false);
  });

  it("treats a disputed claim as sensitive", () => {
    expect(isDisputed({ ...base, claimStatus: "DISPUTED" })).toBe(true);
    expect(isSensitiveClaim({ ...base, claimStatus: "DISPUTED" })).toBe(true);
  });

  it("treats a claim involving a named individual (PERSON) as sensitive", () => {
    expect(involvesNamedIndividual({ ...base, involvedEntityTypes: ["PERSON"] })).toBe(true);
    expect(isSensitiveClaim({ ...base, involvedEntityTypes: ["PERSON"] })).toBe(true);
  });

  it("a plain, undisputed corporate claim is NOT sensitive", () => {
    expect(isSensitiveClaim({ ...base, involvedEntityTypes: ["COMPANY"] })).toBe(false);
  });

  it("requires 1 approval for non-sensitive, 2 for sensitive claims", () => {
    expect(requiredApprovals(false)).toBe(1);
    expect(requiredApprovals(true)).toBe(2);
  });

  it("publishes a non-sensitive claim after one distinct approval", () => {
    expect(canPublish(false, 0)).toBe(false);
    expect(canPublish(false, 1)).toBe(true);
  });

  it("requires TWO distinct approvers to publish a sensitive claim", () => {
    // One approval (even if the same reviewer clicked twice, the caller passes a
    // de-duplicated distinct count) is not enough.
    expect(canPublish(true, 1)).toBe(false);
    expect(canPublish(true, 2)).toBe(true);
  });
});
