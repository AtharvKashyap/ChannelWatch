import { describe, it, expect } from "vitest";
import {
  ChannelSearchResponse,
  ChannelEvidenceResponse,
  ChannelTimelineResponse,
  ResearchedChannelLookup,
} from "../src/schemas.js";

/**
 * Tests for the M3 Track C (public site) response schemas: channel search,
 * itemized evidence, timeline, and the additive `channel_id` on the researched
 * lookup. All additive / lenient in the same discipline as `ownership_history`.
 */

describe("ChannelSearchResponse", () => {
  it("parses a search response with rows", () => {
    const parsed = ChannelSearchResponse.parse({
      query: "cocomelon",
      count: 1,
      results: [
        {
          youtube_channel_id: "UCX6OQ3DkcsbYNE6H8uQQuVA",
          display_name: "CoComelon",
          handle: "@CoComelon",
          classification: "PE_BACKED",
          research_status: "PUBLISHED",
        },
      ],
    });
    expect(parsed.count).toBe(1);
    expect(parsed.results[0]?.classification).toBe("PE_BACKED");
  });

  it("tolerates a null classification / research_status (row exists pre-label)", () => {
    const parsed = ChannelSearchResponse.parse({
      query: "x",
      count: 1,
      results: [
        { youtube_channel_id: "UC_-0123456789abcdefABCD", display_name: "X", classification: null },
      ],
    });
    expect(parsed.results[0]?.classification).toBeNull();
  });

  it("rejects a non-enum classification", () => {
    expect(() =>
      ChannelSearchResponse.parse({
        query: "x",
        count: 1,
        results: [{ youtube_channel_id: "UC1", display_name: "X", classification: "NOPE" }],
      }),
    ).toThrow();
  });
});

describe("ChannelEvidenceResponse", () => {
  it("parses itemized evidence with graded and ungraded sources", () => {
    const parsed = ChannelEvidenceResponse.parse({
      channel_id: "11111111-1111-1111-1111-111111111111",
      evidence_count: 2,
      evidence: [
        {
          id: "s1",
          url: "https://example.com/filing",
          title: "Filing",
          publisher: "SEC",
          tier: 1,
          source_type: "OFFICIAL_REGULATORY_FILING",
          status: "ACTIVE",
          published_at: "2021-11-04",
          archive_url: "https://web.archive.org/x",
          excerpt: "…acquired…",
        },
        { id: "s2", url: "https://example.com/blog", tier: null, status: null },
      ],
    });
    expect(parsed.evidence).toHaveLength(2);
    expect(parsed.evidence[0]?.tier).toBe(1);
    expect(parsed.evidence[1]?.tier).toBeNull();
  });

  it("rejects a non-url source", () => {
    expect(() =>
      ChannelEvidenceResponse.parse({
        channel_id: "c",
        evidence_count: 1,
        evidence: [{ id: "s", url: "not-a-url" }],
      }),
    ).toThrow();
  });
});

describe("ChannelTimelineResponse", () => {
  it("parses relationship and claim events, including null dates", () => {
    const parsed = ChannelTimelineResponse.parse({
      channel_id: "c",
      events: [
        {
          date: "2021-11-04",
          kind: "RELATIONSHIP",
          type: "ACQUIRED",
          subject: "Moonbug",
          object: "CoComelon",
          status: "ACTIVE",
        },
        { date: null, kind: "CLAIM", type: "OWNED_BY", subject: "X", object: null, status: null },
      ],
    });
    expect(parsed.events).toHaveLength(2);
    expect(parsed.events[1]?.date).toBeNull();
  });

  it("rejects an unknown event kind", () => {
    expect(() =>
      ChannelTimelineResponse.parse({
        channel_id: "c",
        events: [
          { date: null, kind: "OTHER", type: "x", subject: null, object: null, status: null },
        ],
      }),
    ).toThrow();
  });
});

describe("ResearchedChannelLookup additive channel_id", () => {
  const base = {
    researched: true as const,
    youtube_channel_id: "UCX6OQ3DkcsbYNE6H8uQQuVA",
    display_name: "CoComelon",
    classification: {
      label: "PE_BACKED" as const,
      confidence: 0.93,
      confidence_label: "CONFIRMED" as const,
      summary: "Public records indicate that Moonbug owns CoComelon.",
    },
    direct_owner: null,
    ultimate_parent: null,
    creator_status: null,
    last_reviewed_at: null,
    evidence_count: 0,
    disputed: false,
    research_status: "PUBLISHED" as const,
    badge_color: "ORANGE" as const,
    disclaimer: "No conclusion is made about editorial interference.",
    warnings: [],
  };

  it("is valid WITHOUT channel_id (backward-compatible)", () => {
    expect(ResearchedChannelLookup.parse(base).channel_id).toBeUndefined();
  });

  it("carries channel_id when present", () => {
    const parsed = ResearchedChannelLookup.parse({ ...base, channel_id: "the-uuid" });
    expect(parsed.channel_id).toBe("the-uuid");
  });
});
