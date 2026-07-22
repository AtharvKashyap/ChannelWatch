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

/**
 * Base record whose PORTFOLIO_COMPANY_OF relationship (index 1) is supported by
 * the given Tier-2 sources. The OWNS relationship (index 0) is backed by a Tier-1
 * acquisition source so only the PE-implying edge exercises the two-Tier-2 rule.
 * Each portfolio source is `{ publisher?, title }` — omit `publisher` to model a
 * source that recorded no outlet.
 */
function portfolioTier2Record(portfolioSources: { publisher?: string; title: string }[]): unknown {
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
      ...portfolioSources.map((s, i) => ({
        ref: `portfolio-${i}`,
        url: `https://tier2-${i}.example/portfolio`,
        title: s.title,
        ...(s.publisher !== undefined ? { publisher: s.publisher } : {}),
        source_type: "ESTABLISHED_INDUSTRY_PUBLICATION",
        tier: 2,
        excerpt: "Example Media is a portfolio company.",
        supports: [{ relationship: 1 }],
      })),
    ],
    review: {
      researched_by: "researcher@channelwatch.local",
      last_reviewed_at: "2026-07-18",
    },
  };
}

/**
 * Record whose sole relationship is `capital OWNS media`, where `capital` is a
 * PRIVATE_EQUITY_FIRM. The relationship type is OWNS (NOT PORTFOLIO_COMPANY_OF),
 * so it exercises the PE-endpoint trigger path. The single source's tier is the
 * caller's choice.
 */
function peEndpointOwnsRecord(sourceType: string, tier: 1 | 2): unknown {
  return {
    channel: {
      youtube_channel_id: "UCabcdefghijklmnopqrstuv",
      display_name: "Example Channel",
    },
    entities: [
      {
        slug: "capital",
        canonical_name: "Example Capital Partners",
        entity_type: "PRIVATE_EQUITY_FIRM",
      },
      { slug: "media", canonical_name: "Example Media LLC", entity_type: "COMPANY" },
    ],
    relationships: [
      {
        subject: "capital",
        type: "OWNS",
        object: "media",
        control_level: "CONTROLLING",
        confidence: 0.9,
        status: "ACTIVE",
      },
    ],
    sources: [
      {
        ref: "ownership",
        url: "https://example.com/ownership",
        title: "Ownership record",
        publisher: "Registry",
        source_type: sourceType,
        tier,
        excerpt: "Example Capital owns Example Media.",
        supports: [{ relationship: 0 }],
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

  it("accepts a PE relationship backed by two independent Tier 2 publishers", () => {
    expect(() =>
      validateResearchRecord(
        portfolioTier2Record([
          { publisher: "Forbes", title: "Forbes report" },
          { publisher: "Bloomberg", title: "Bloomberg report" },
        ]),
      ),
    ).not.toThrow();
  });

  it("rejects a PE relationship backed by two publisher-less Tier 2 sources (different titles)", () => {
    // Regression: a title must NEVER stand in for a publisher, or two anonymous
    // Tier-2 sources with different titles would masquerade as two independent
    // publishers and wrongly publish the PE label.
    expect(() =>
      validateResearchRecord(
        portfolioTier2Record([{ title: "Some blog post" }, { title: "A different blog post" }]),
      ),
    ).toThrow(/cannot be\s+published/);
  });

  it("triggers the PE gate on a PRIVATE_EQUITY_FIRM endpoint even when the type is not PORTFOLIO_COMPANY_OF", () => {
    // capital OWNS media: no PORTFOLIO_COMPANY_OF anywhere, but `capital` is a PE
    // firm, so the gate must still fire — and reject on a single Tier-2 source.
    expect(() =>
      validateResearchRecord(peEndpointOwnsRecord("ESTABLISHED_INDUSTRY_PUBLICATION", 2)),
    ).toThrow(/cannot be\s+published/);
  });

  it("accepts a PE-endpoint OWNS relationship once backed by a Tier 1 source", () => {
    expect(() =>
      validateResearchRecord(peEndpointOwnsRecord("CORPORATE_REGISTRY_RECORD", 1)),
    ).not.toThrow();
  });
});
