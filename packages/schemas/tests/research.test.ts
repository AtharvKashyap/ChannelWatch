import { describe, it, expect } from "vitest";
import { ResearchRecord } from "../src/research.js";

/**
 * A structurally valid ResearchRecord mirroring the SPEC §35 example. Tests
 * clone and mutate this to exercise one refinement at a time. The PE-label rule
 * is NOT a schema refinement (the importer enforces it), so this record parses
 * cleanly here even though its evidence is what the importer would evaluate.
 */
function baseRecord(): Record<string, unknown> {
  return {
    channel: {
      youtube_channel_id: "UCabcdefghijklmnopqrstuv",
      display_name: "Example Channel",
      handle: "@examplechannel",
    },
    entities: [
      { slug: "media", canonical_name: "Example Media LLC", entity_type: "COMPANY" },
      {
        slug: "capital",
        canonical_name: "Example Capital Partners",
        entity_type: "PRIVATE_EQUITY_FIRM",
      },
      { slug: "creator", canonical_name: "Original Creator", entity_type: "CREATOR" },
    ],
    relationships: [
      {
        subject: "media",
        type: "OWNS",
        object: "channel",
        control_level: "CONTROLLING",
        effective_from: "2025-03-12",
        confidence: 0.93,
        status: "ACTIVE",
      },
      {
        subject: "media",
        type: "PORTFOLIO_COMPANY_OF",
        object: "capital",
        confidence: 0.93,
        status: "ACTIVE",
      },
      {
        subject: "channel",
        type: "HOSTED_BY",
        object: "creator",
        confidence: 0.8,
        status: "ACTIVE",
      },
    ],
    sources: [
      {
        ref: "acq",
        url: "https://example.com/press/acquires",
        title: "Example Media Acquires Example Channel",
        publisher: "Example Media",
        published_at: "2025-03-12",
        source_type: "OFFICIAL_ACQUISITION_ANNOUNCEMENT",
        tier: 1,
        excerpt: "Example Media announced it has acquired Example Channel.",
        supports: [{ relationship: 0 }],
      },
      {
        ref: "portfolio",
        url: "https://examplecapital.com/portfolio/example-media",
        title: "Example Media Portfolio Listing",
        source_type: "INVESTOR_PORTFOLIO_LISTING",
        tier: 1,
        excerpt: "Example Media is a portfolio company of Example Capital Partners.",
        supports: [{ relationship: 1 }],
      },
      {
        ref: "trade",
        url: "https://tradepress.example/expands",
        title: "Example Media Expands Creator Portfolio",
        publisher: "Trade Press",
        published_at: "2025-03-13",
        source_type: "ESTABLISHED_INDUSTRY_PUBLICATION",
        tier: 2,
        excerpt: "Original Creator continues to host the channel.",
        supports: [{ relationship: 0 }, { relationship: 2 }],
      },
    ],
    review: {
      researched_by: "researcher@channelwatch.local",
      reviewed_by: "reviewer@channelwatch.local",
      last_reviewed_at: "2026-07-18",
    },
  };
}

describe("ResearchRecord schema", () => {
  it("parses a structurally valid §35-style record", () => {
    const result = ResearchRecord.safeParse(baseRecord());
    expect(result.success).toBe(true);
  });

  it("rejects a canonical-id violation on the channel", () => {
    const record = baseRecord();
    (record.channel as Record<string, unknown>).youtube_channel_id = "@notanid";
    expect(ResearchRecord.safeParse(record).success).toBe(false);
  });

  it("rejects a relationship with no supporting source", () => {
    const record = baseRecord();
    // Drop the trade source's support for relationship 2 (HOSTED_BY), leaving it
    // unsupported.
    (record.sources as { supports: unknown[] }[])[2]!.supports = [{ relationship: 0 }];
    const result = ResearchRecord.safeParse(record);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain("no supporting source");
  });

  it("rejects a source whose tier disagrees with its source_type", () => {
    const record = baseRecord();
    // OFFICIAL_ACQUISITION_ANNOUNCEMENT is Tier 1; claiming Tier 2 must fail.
    (record.sources as { tier: number }[])[0]!.tier = 2;
    const result = ResearchRecord.safeParse(record);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain("Tier 1");
  });

  it("rejects a Tier 4 source backing a published (ACTIVE) relationship", () => {
    const record = baseRecord();
    (record.sources as unknown[]).push({
      ref: "tip",
      url: "https://tips.example/anon",
      title: "Anonymous tip",
      source_type: "ANONYMOUS_TIP",
      tier: 4,
      excerpt: "Someone said the channel was acquired.",
      supports: [{ relationship: 0 }],
    });
    const result = ResearchRecord.safeParse(record);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain("Tier 4 is leads-only");
  });

  it("rejects a relationship endpoint that resolves to no declared entity", () => {
    const record = baseRecord();
    (record.relationships as { subject: string }[])[0]!.subject = "ghost";
    const result = ResearchRecord.safeParse(record);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain("declared entity slug");
  });

  it("rejects a source support index pointing at a nonexistent relationship", () => {
    const record = baseRecord();
    (record.sources as { supports: unknown[] }[])[0]!.supports = [{ relationship: 99 }];
    const result = ResearchRecord.safeParse(record);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).toContain("does not exist");
  });

  it("rejects an excerpt longer than 500 characters", () => {
    const record = baseRecord();
    (record.sources as { excerpt: string }[])[0]!.excerpt = "x".repeat(501);
    expect(ResearchRecord.safeParse(record).success).toBe(false);
  });

  it("allows a Tier 4 source to back a non-published (PENDING_REVIEW) relationship", () => {
    const record = baseRecord();
    (record.relationships as { status: string }[])[2]!.status = "PENDING_REVIEW";
    (record.sources as unknown[]).push({
      ref: "tip",
      url: "https://tips.example/anon",
      title: "Anonymous tip",
      source_type: "ANONYMOUS_TIP",
      tier: 4,
      excerpt: "A lead about the host.",
      supports: [{ relationship: 2 }],
    });
    expect(ResearchRecord.safeParse(record).success).toBe(true);
  });
});
