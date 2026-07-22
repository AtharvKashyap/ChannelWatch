import { describe, it, expect } from "vitest";
import {
  CorrectionSubmission,
  ResearchLeadSubmission,
  ChannelLookupPayload,
  ResearchedChannelLookup,
  UnresearchedChannelLookup,
} from "../src/schemas.js";

const VALID_ID = "UCKAqou7V9FAWXpZd9xtOg3Q";

describe("CorrectionSubmission", () => {
  it("accepts a minimal anonymous correction (channel + explanation only)", () => {
    const parsed = CorrectionSubmission.parse({
      youtube_channel_id: VALID_ID,
      explanation: "This ownership record is out of date; the parent divested in 2025.",
    });
    expect(parsed.youtube_channel_id).toBe(VALID_ID);
    expect(parsed.submitter_email).toBeUndefined();
  });

  it("accepts optional submitter identity and a claim id", () => {
    const parsed = CorrectionSubmission.parse({
      youtube_channel_id: VALID_ID,
      claim_id: "11111111-1111-4111-8111-111111111111",
      submitter_name: "Jane",
      submitter_email: "jane@example.com",
      submitter_relationship: "Company representative",
      explanation: "The controlling stake figure is incorrect per the latest filing.",
    });
    expect(parsed.claim_id).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("rejects a non-canonical channel id", () => {
    expect(() =>
      CorrectionSubmission.parse({ youtube_channel_id: "@handle", explanation: "x".repeat(25) }),
    ).toThrow();
  });

  it("rejects a too-short explanation", () => {
    expect(() =>
      CorrectionSubmission.parse({ youtube_channel_id: VALID_ID, explanation: "too short" }),
    ).toThrow();
  });

  it("rejects a malformed email", () => {
    expect(() =>
      CorrectionSubmission.parse({
        youtube_channel_id: VALID_ID,
        submitter_email: "not-an-email",
        explanation: "A sufficiently long and substantive explanation of the issue.",
      }),
    ).toThrow();
  });
});

describe("ResearchLeadSubmission", () => {
  it("accepts just a channel id (a bare lead)", () => {
    const parsed = ResearchLeadSubmission.parse({ youtube_channel_id: VALID_ID });
    expect(parsed.youtube_channel_id).toBe(VALID_ID);
  });

  it("accepts an evidence url and note", () => {
    const parsed = ResearchLeadSubmission.parse({
      youtube_channel_id: VALID_ID,
      evidence_url: "https://example.com/filing",
      note: "This channel appears to have been acquired.",
    });
    expect(parsed.evidence_url).toBe("https://example.com/filing");
  });

  it("rejects a malformed evidence url", () => {
    expect(() =>
      ResearchLeadSubmission.parse({ youtube_channel_id: VALID_ID, evidence_url: "not a url" }),
    ).toThrow();
  });
});

describe("ChannelLookupPayload", () => {
  it("validates a researched payload", () => {
    const payload = {
      researched: true as const,
      youtube_channel_id: VALID_ID,
      display_name: "Little Baby Bum",
      research_status: "PUBLISHED",
      classification: {
        label: "PE_BACKED",
        confidence: 0.75,
        confidence_label: "MODERATE",
        summary: "Public records indicate that Moonbug owns it.",
      },
      badge_color: "ORANGE",
      disclaimer: "No conclusion is made about editorial interference.",
      warnings: [],
      direct_owner: { id: "e1", name: "Moonbug", type: "COMPANY" },
      ultimate_parent: { id: "e2", name: "Blackstone", type: "PRIVATE_EQUITY_FIRM" },
      creator_status: null,
      last_reviewed_at: "2026-07-22T00:00:00Z",
      evidence_count: 4,
      disputed: false,
    };
    expect(() => ResearchedChannelLookup.parse(payload)).not.toThrow();
    const via = ChannelLookupPayload.parse(payload);
    expect(via.researched).toBe(true);
  });

  it("validates an unresearched payload", () => {
    const payload = {
      researched: false as const,
      youtube_channel_id: "UCunknownunknownunknown",
      research_status: "UNRESEARCHED" as const,
      summary: "This channel has not yet been researched.",
      disclaimer: "This channel has not yet been researched.",
    };
    expect(() => UnresearchedChannelLookup.parse(payload)).not.toThrow();
    const via = ChannelLookupPayload.parse(payload);
    expect(via.researched).toBe(false);
  });
});
