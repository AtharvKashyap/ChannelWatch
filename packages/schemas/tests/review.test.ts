import { describe, it, expect } from "vitest";
import {
  LoginRequest,
  ReviewDecisionRequest,
  EntityCreateRequest,
  EntityUpdateRequest,
  ClaimQueueItem,
  CorrectionResolutionRequest,
  AuditListResponse,
  REVIEW_CONSOLE_COPY,
} from "../src/index.js";

describe("reviewer request schemas", () => {
  it("LoginRequest requires a valid email and a non-empty password", () => {
    expect(LoginRequest.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(LoginRequest.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
    expect(LoginRequest.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });

  it("ReviewDecisionRequest enforces substantive reasoning (>=10 chars)", () => {
    expect(ReviewDecisionRequest.safeParse({ reasoning: "short" }).success).toBe(false);
    expect(
      ReviewDecisionRequest.safeParse({ reasoning: "Tier-1 filing confirms the acquisition." })
        .success,
    ).toBe(true);
  });

  it("CorrectionResolutionRequest also requires reasoning", () => {
    expect(CorrectionResolutionRequest.safeParse({ reasoning: "no" }).success).toBe(false);
    expect(
      CorrectionResolutionRequest.safeParse({ reasoning: "Superseded by a newer filing." }).success,
    ).toBe(true);
  });

  it("EntityCreateRequest validates the entity type against the enum", () => {
    expect(
      EntityCreateRequest.safeParse({ entity_type: "COMPANY", canonical_name: "Acme" }).success,
    ).toBe(true);
    expect(
      EntityCreateRequest.safeParse({ entity_type: "NOT_A_TYPE", canonical_name: "Acme" }).success,
    ).toBe(false);
    // A non-URL website is rejected.
    expect(
      EntityCreateRequest.safeParse({
        entity_type: "COMPANY",
        canonical_name: "Acme",
        website: "not a url",
      }).success,
    ).toBe(false);
  });

  it("EntityUpdateRequest rejects an empty body but accepts a single field", () => {
    expect(EntityUpdateRequest.safeParse({}).success).toBe(false);
    expect(EntityUpdateRequest.safeParse({ canonical_name: "New Name" }).success).toBe(true);
  });
});

describe("reviewer response schemas", () => {
  it("ClaimQueueItem carries the two-person-review decision surface", () => {
    const item = {
      id: "c1",
      subject_type: "CHANNEL",
      subject_id: "s1",
      subject_name: "Example",
      predicate: "OWNED_BY",
      object_type: "ENTITY",
      object_id: "o1",
      object_name: "Owner",
      confidence: 0.9,
      confidence_label: "CONFIRMED",
      claim_status: "UNDER_REVIEW",
      effective_date: null,
      review_notes: null,
      sensitive: true,
      distinct_approvers: 1,
      can_publish: false,
      reviews: [],
    };
    expect(ClaimQueueItem.safeParse(item).success).toBe(true);
  });

  it("AuditListResponse validates a paginated envelope", () => {
    const parsed = AuditListResponse.safeParse({
      count: 1,
      limit: 50,
      offset: 0,
      events: [
        {
          id: "a1",
          actor_id: null,
          action: "APPROVE_CLAIM",
          object_type: "claim",
          object_id: "c1",
          before_state: null,
          after_state: { claim_status: "PUBLISHED" },
          created_at: "2026-07-23T00:00:00Z",
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("REVIEW_CONSOLE_COPY", () => {
  it("provides the two-person-review process language (never an accusation)", () => {
    expect(REVIEW_CONSOLE_COPY.sensitiveFlag).toBe("Second review required");
    expect(REVIEW_CONSOLE_COPY.sensitiveExplanation.toLowerCase()).toContain("two-person");
    // Neutral, process-oriented — asserts no wrongdoing.
    expect(REVIEW_CONSOLE_COPY.sensitiveExplanation.toLowerCase()).not.toContain("fraud");
  });
});
