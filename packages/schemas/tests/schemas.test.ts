import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  YoutubeChannelId,
  Channel,
  Entity,
  Relationship,
  Source,
  Claim,
  ChannelLookupResponse,
} from "../src/schemas.js";

const fixture = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("./fixtures/channel-lookup-response.json", import.meta.url)),
    "utf8",
  ),
);

describe("YoutubeChannelId", () => {
  it("accepts UC + 22 valid chars", () => {
    expect(YoutubeChannelId.parse("UCX6OQ3DkcsbYNE6H8uQQuVA")).toBe("UCX6OQ3DkcsbYNE6H8uQQuVA");
    expect(YoutubeChannelId.parse("UC_-0123456789abcdefABCD")).toBe("UC_-0123456789abcdefABCD");
  });

  it("rejects handles, names, and wrong lengths", () => {
    expect(() => YoutubeChannelId.parse("@mkbhd")).toThrow();
    expect(() => YoutubeChannelId.parse("Example Channel")).toThrow();
    expect(() => YoutubeChannelId.parse("UC123456789")).toThrow(); // too short
    expect(() => YoutubeChannelId.parse("UCX6OQ3DkcsbYNE6H8uQQuVAextra")).toThrow(); // too long
    expect(() => YoutubeChannelId.parse("XCX6OQ3DkcsbYNE6H8uQQuVA")).toThrow(); // wrong prefix
    expect(() => YoutubeChannelId.parse("UCX6OQ3DkcsbYNE6H8uQQu!A")).toThrow(); // bad char
  });
});

describe("Entity", () => {
  it("parses a valid entity", () => {
    const e = Entity.parse({ id: "entity-1", name: "Example Media LLC", type: "COMPANY" });
    expect(e.type).toBe("COMPANY");
  });

  it("rejects invalid entity type", () => {
    expect(() => Entity.parse({ id: "e", name: "x", type: "BANK" })).toThrow();
  });
});

describe("Channel", () => {
  it("parses a valid channel", () => {
    const c = Channel.parse({
      youtube_channel_id: "UCX6OQ3DkcsbYNE6H8uQQuVA",
      display_name: "Example Channel",
    });
    expect(c.youtube_channel_id).toBe("UCX6OQ3DkcsbYNE6H8uQQuVA");
  });

  it("rejects an invalid channel id", () => {
    expect(() => Channel.parse({ youtube_channel_id: "@handle", display_name: "x" })).toThrow();
  });
});

describe("Relationship (§15.3)", () => {
  it("parses a full relationship with nullable percentage", () => {
    const r = Relationship.parse({
      type: "PORTFOLIO_COMPANY_OF",
      from_entity_id: "entity-123",
      to_entity_id: "entity-456",
      effective_from: "2025-03-12",
      effective_to: null,
      ownership_percentage: null,
      control_level: "CONTROLLING",
      confidence: 0.93,
      source_ids: ["src-1", "src-2"],
    });
    expect(r.ownership_percentage).toBeNull();
    expect(r.control_level).toBe("CONTROLLING");
  });

  it("defaults status to ACTIVE when omitted and accepts an explicit status", () => {
    const implicit = Relationship.parse({
      type: "OWNS",
      from_entity_id: "a",
      to_entity_id: "b",
      control_level: "CONTROLLING",
      confidence: 0.9,
      source_ids: [],
    });
    expect(implicit.status).toBe("ACTIVE");

    const explicit = Relationship.parse({
      type: "OWNS",
      from_entity_id: "a",
      to_entity_id: "b",
      control_level: "CONTROLLING",
      confidence: 0.9,
      source_ids: [],
      status: "DISPUTED",
    });
    expect(explicit.status).toBe("DISPUTED");
  });

  it("accepts a numeric ownership percentage in range", () => {
    const r = Relationship.parse({
      type: "PARTIALLY_OWNS",
      from_entity_id: "a",
      to_entity_id: "b",
      ownership_percentage: 40,
      control_level: "MINORITY",
      confidence: 0.6,
      source_ids: [],
    });
    expect(r.ownership_percentage).toBe(40);
  });

  it("rejects confidence outside 0–1", () => {
    expect(() =>
      Relationship.parse({
        type: "OWNS",
        from_entity_id: "a",
        to_entity_id: "b",
        control_level: "CONTROLLING",
        confidence: 1.5,
        source_ids: [],
      }),
    ).toThrow();
  });
});

describe("Source", () => {
  it("parses a valid source with tier and status", () => {
    const s = Source.parse({
      id: "src-1",
      url: "https://example.com/press-release",
      tier: 1,
      status: "ACTIVE",
      archive_url: "https://web.archive.org/x",
      content_hash: "abc123",
    });
    expect(s.tier).toBe(1);
  });

  it("rejects an invalid tier", () => {
    expect(() =>
      Source.parse({ id: "s", url: "https://x.com", tier: 5, status: "ACTIVE" }),
    ).toThrow();
  });

  it("rejects a non-url", () => {
    expect(() => Source.parse({ id: "s", url: "not-a-url", tier: 1, status: "ACTIVE" })).toThrow();
  });
});

describe("Claim (§7, §8.3, §16)", () => {
  it("parses a valid subject/predicate/object claim", () => {
    const c = Claim.parse({
      id: "claim-1",
      subject_type: "CHANNEL",
      subject_id: "chan-1",
      predicate: "OWNED_BY",
      object_type: "ENTITY",
      object_id: "entity-1",
      confidence: 0.85,
      claim_status: "PUBLISHED",
      effective_date: "2025-03-12",
    });
    expect(c.claim_status).toBe("PUBLISHED");
    expect(c.predicate).toBe("OWNED_BY");
    expect(c.object_id).toBe("entity-1");
  });

  it("parses a claim with a JSONB literal value and no object reference", () => {
    const c = Claim.parse({
      id: "claim-2",
      subject_type: "CHANNEL",
      subject_id: "chan-1",
      predicate: "SUBSCRIBER_RANGE",
      literal_value: { min: 1_000_000, max: 5_000_000 },
      claim_status: "DRAFT",
    });
    expect(c.literal_value).toEqual({ min: 1_000_000, max: 5_000_000 });
    expect(c.object_id).toBeUndefined();
  });

  it("rejects confidence outside 0–1", () => {
    expect(() =>
      Claim.parse({
        id: "claim-1",
        subject_type: "CHANNEL",
        subject_id: "chan-1",
        predicate: "OWNED_BY",
        confidence: 1.2,
        claim_status: "PUBLISHED",
      }),
    ).toThrow();
  });

  it("rejects an invalid claim_status enum value", () => {
    expect(() =>
      Claim.parse({
        id: "claim-1",
        subject_type: "CHANNEL",
        subject_id: "chan-1",
        predicate: "OWNED_BY",
        confidence: 0.85,
        claim_status: "APPROVED",
      }),
    ).toThrow();
  });

  it("rejects a claim missing the subject", () => {
    expect(() =>
      Claim.parse({
        id: "claim-1",
        predicate: "OWNED_BY",
        claim_status: "PUBLISHED",
      }),
    ).toThrow();
  });
});

describe("ChannelLookupResponse (§17.2)", () => {
  it("parses the SPEC §17.2 example verbatim", () => {
    const parsed = ChannelLookupResponse.parse(fixture);
    expect(parsed.classification.label).toBe("PE_BACKED");
    expect(parsed.classification.confidence_label).toBe("CONFIRMED");
    expect(parsed.classification.confidence).toBe(0.93);
    expect(parsed.direct_owner?.type).toBe("COMPANY");
    expect(parsed.ultimate_parent?.type).toBe("PRIVATE_EQUITY_FIRM");
    expect(parsed.creator_status?.status).toBe("REMAINS_HOST");
    expect(parsed.evidence_count).toBe(4);
    expect(parsed.disputed).toBe(false);
  });

  it("round-trips the fixture unchanged", () => {
    const parsed = ChannelLookupResponse.parse(fixture);
    expect(parsed).toEqual(fixture);
  });

  it("additive ownership_chain is optional (the §17.2 example omits it)", () => {
    const parsed = ChannelLookupResponse.parse(fixture);
    expect(parsed.ownership_chain).toBeUndefined();
  });

  it("parses an additive ownership_chain and direct_owner.mechanism when present", () => {
    const withChain = {
      ...fixture,
      direct_owner: { ...fixture.direct_owner, mechanism: "acquired" },
      ownership_chain: [
        {
          name: "Moonbug Entertainment",
          type: "COMPANY",
          relationship: "OWNS",
          ownership_percentage: null,
          control_level: "CONTROLLING",
          effective_from: null,
        },
        {
          name: "Blackstone",
          type: "PRIVATE_EQUITY_FIRM",
          relationship: "PORTFOLIO_COMPANY_OF",
          ownership_percentage: null,
          control_level: "UNKNOWN",
          effective_from: "2021-11-04",
        },
      ],
    };
    const parsed = ChannelLookupResponse.parse(withChain);
    expect(parsed.direct_owner?.mechanism).toBe("acquired");
    expect(parsed.ownership_chain).toHaveLength(2);
    expect(parsed.ownership_chain?.[0]?.name).toBe("Moonbug Entertainment");
    expect(parsed.ownership_chain?.[1]?.relationship).toBe("PORTFOLIO_COMPANY_OF");
    expect(parsed.ownership_chain?.[1]?.ownership_percentage).toBeNull();
  });
});
