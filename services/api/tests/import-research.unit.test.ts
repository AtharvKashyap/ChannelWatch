import { describe, it, expect } from "vitest";
import { validateResearchRecord, assertPePublishable } from "../scripts/import-research.js";

/**
 * Non-DB unit tests for the importer's trust gate. These run in CI without
 * Postgres. The §14.3 PE-label rule is enforced here (not in the Zod schema, to
 * avoid a schemas→scoring cycle), so it is tested against the importer directly.
 */

function peRecord(portfolioSourceTier: 1 | 2, portfolioSourceType: string): unknown {
  return {
    channel: {
      youtube_channel_id: "UCabcdefghijklmnopqrstuv",
      display_name: "Example Channel",
    },
    entities: [
      { slug: "media", canonical_name: "Example Media LLC", entity_type: "COMPANY" },
      {
        slug: "capital",
        canonical_name: "Example Capital Partners",
        entity_type: "PRIVATE_EQUITY_FIRM",
      },
    ],
    relationships: [
      {
        subject: "media",
        type: "OWNS",
        object: "channel",
        control_level: "CONTROLLING",
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
    ],
    sources: [
      {
        ref: "acq",
        url: "https://example.com/acq",
        title: "Acquisition",
        publisher: "Example Media",
        source_type: "OFFICIAL_ACQUISITION_ANNOUNCEMENT",
        tier: 1,
        excerpt: "Example Media acquired the channel.",
        supports: [{ relationship: 0 }],
      },
      {
        ref: "portfolio",
        url: "https://examplecapital.com/portfolio",
        title: "Portfolio listing",
        publisher: "Example Capital Partners",
        source_type: portfolioSourceType,
        tier: portfolioSourceTier,
        excerpt: "Example Media is a portfolio company.",
        supports: [{ relationship: 1 }],
      },
    ],
    review: {
      researched_by: "researcher@channelwatch.local",
      last_reviewed_at: "2026-07-18",
    },
  };
}

describe("assertPePublishable / validateResearchRecord (§14.3 PE gate)", () => {
  it("accepts a PE relationship backed by a Tier 1 source", () => {
    const record = validateResearchRecord(peRecord(1, "INVESTOR_PORTFOLIO_LISTING"));
    expect(() => assertPePublishable(record)).not.toThrow();
  });

  it("rejects a PE relationship backed by only a single Tier 2 source", () => {
    expect(() => validateResearchRecord(peRecord(2, "ESTABLISHED_INDUSTRY_PUBLICATION"))).toThrow(
      /cannot be\s+published/,
    );
  });
});
