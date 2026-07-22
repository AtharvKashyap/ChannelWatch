import type { ResearchedChannelLookup, UnresearchedChannelLookup } from "@channelwatch/schemas";

export function researchedFixture(
  overrides: Partial<ResearchedChannelLookup> = {},
): ResearchedChannelLookup {
  return {
    youtube_channel_id: "UC1111111111111111111111",
    display_name: "Example Channel",
    classification: {
      label: "INDEPENDENT",
      confidence: 0.5,
      confidence_label: "MODERATE",
      summary: "No ownership evidence found.",
    },
    direct_owner: null,
    ultimate_parent: null,
    creator_status: null,
    last_reviewed_at: "2026-01-01",
    evidence_count: 0,
    disputed: false,
    researched: true,
    research_status: "PUBLISHED",
    badge_color: "NEUTRAL",
    disclaimer: "This is not an editorial conclusion.",
    warnings: [],
    ...overrides,
  };
}

export function unresearchedFixture(
  overrides: Partial<UnresearchedChannelLookup> = {},
): UnresearchedChannelLookup {
  return {
    youtube_channel_id: "UC2222222222222222222222",
    researched: false,
    research_status: "UNRESEARCHED",
    summary: "This channel has not yet been researched.",
    disclaimer: "This is not an editorial conclusion.",
    ...overrides,
  };
}
