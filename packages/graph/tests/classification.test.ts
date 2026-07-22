import { describe, it, expect } from "vitest";
import { deriveClassification } from "../src/classification.js";
import { rel, entity, monthsBefore } from "./helpers.js";

const CHAN = "chan-x";
const ASOF = new Date("2026-07-21T00:00:00Z");

describe("deriveClassification — SPEC §15.4/§35 acceptance case (PE_BACKED)", () => {
  const entities = [
    entity("creatorA", "CREATOR", "Creator A"),
    entity("pc", "COMPANY", "Production Company"),
    entity("mg", "MEDIA_NETWORK", "Media Group"),
    entity("pe", "PRIVATE_EQUITY_FIRM", "PE Firm"),
  ];
  const relationships = [
    rel({
      type: "OWNS",
      from_entity_id: "pc",
      to_entity_id: CHAN,
      control_level: "CONTROLLING",
      confidence: 0.95,
    }),
    rel({ type: "SUBSIDIARY_OF", from_entity_id: "pc", to_entity_id: "mg", confidence: 0.9 }),
    rel({
      type: "PORTFOLIO_COMPANY_OF",
      from_entity_id: "mg",
      to_entity_id: "pe",
      confidence: 0.93,
    }),
    rel({ type: "FOUNDED_BY", from_entity_id: CHAN, to_entity_id: "creatorA", confidence: 0.8 }),
  ];

  it("derives PE_BACKED with the §26.2 explanation codes and correct chain", () => {
    const r = deriveClassification({ channelId: CHAN, relationships, entities, asOf: ASOF });
    expect(r.classification).toBe("PE_BACKED");
    expect(r.directOwner?.id).toBe("pc");
    expect(r.ultimateParent?.id).toBe("pe");
    expect(r.ultimateParent?.type).toBe("PRIVATE_EQUITY_FIRM");
    expect(r.chain.map((e) => e.type)).toEqual(["OWNS", "SUBSIDIARY_OF", "PORTFOLIO_COMPANY_OF"]);
    expect(r.explanationCodes).toEqual(
      expect.arrayContaining(["DIRECT_OWNER_CONFIRMED", "OWNER_IS_PE_PORTFOLIO_COMPANY"]),
    );
  });

  it("propagates min-confidence across the load-bearing chain", () => {
    const r = deriveClassification({ channelId: CHAN, relationships, entities, asOf: ASOF });
    expect(r.confidence).toBeCloseTo(0.9, 10);
  });
});

describe("deriveClassification — direct PE owner", () => {
  it("is PE_BACKED when the direct owner is itself a PE firm", () => {
    const entities = [entity("pe", "PRIVATE_EQUITY_FIRM", "PE")];
    const r = deriveClassification({
      channelId: CHAN,
      relationships: [rel({ type: "OWNS", from_entity_id: "pe", to_entity_id: CHAN })],
      entities,
      asOf: ASOF,
    });
    expect(r.classification).toBe("PE_BACKED");
  });
});

describe("deriveClassification — creator owned", () => {
  it("is CREATOR_OWNED when the direct owner is a CREATOR", () => {
    const entities = [entity("creator", "CREATOR", "Creator")];
    const r = deriveClassification({
      channelId: CHAN,
      relationships: [rel({ type: "OWNS", from_entity_id: "creator", to_entity_id: CHAN })],
      entities,
      asOf: ASOF,
    });
    expect(r.classification).toBe("CREATOR_OWNED");
    expect(r.directOwner?.id).toBe("creator");
    expect(r.ultimateParent?.id).toBe("creator");
  });

  it("is CREATOR_OWNED for a creator LLC (FOUNDED_BY + controlling PARTIALLY_OWNS)", () => {
    const entities = [
      entity("llc", "COMPANY", "Creator LLC"),
      entity("creator", "CREATOR", "Creator"),
    ];
    const relationships = [
      rel({ type: "OWNS", from_entity_id: "llc", to_entity_id: CHAN }),
      rel({ type: "FOUNDED_BY", from_entity_id: "llc", to_entity_id: "creator" }),
      rel({
        type: "PARTIALLY_OWNS",
        from_entity_id: "creator",
        to_entity_id: "llc",
        control_level: "CONTROLLING",
      }),
    ];
    const r = deriveClassification({ channelId: CHAN, relationships, entities, asOf: ASOF });
    expect(r.classification).toBe("CREATOR_OWNED");
  });
});

describe("deriveClassification — corporate owned", () => {
  it("is CORPORATE_OWNED when a plain company owns the channel (no PE, no creator control)", () => {
    const entities = [entity("co", "COMPANY", "MegaCorp")];
    const r = deriveClassification({
      channelId: CHAN,
      relationships: [rel({ type: "OWNS", from_entity_id: "co", to_entity_id: CHAN })],
      entities,
      asOf: ASOF,
    });
    expect(r.classification).toBe("CORPORATE_OWNED");
  });
});

describe("deriveClassification — externally funded", () => {
  it("is EXTERNALLY_FUNDED for a creator owner with an active minority investment into the owner", () => {
    const entities = [
      entity("creator", "CREATOR", "Creator"),
      entity("vc", "VENTURE_CAPITAL_FIRM", "VC"),
    ];
    const relationships = [
      rel({ type: "OWNS", from_entity_id: "creator", to_entity_id: CHAN }),
      rel({
        type: "INVESTED_IN",
        from_entity_id: "vc",
        to_entity_id: "creator",
        control_level: "MINORITY",
      }),
    ];
    const r = deriveClassification({ channelId: CHAN, relationships, entities, asOf: ASOF });
    expect(r.classification).toBe("EXTERNALLY_FUNDED");
  });

  it("is EXTERNALLY_FUNDED when the minority funding flows into the channel directly", () => {
    const entities = [entity("creator", "CREATOR", "Creator"), entity("fund", "FUND", "Fund")];
    const relationships = [
      rel({ type: "OWNS", from_entity_id: "creator", to_entity_id: CHAN }),
      rel({ type: "FUNDS", from_entity_id: "fund", to_entity_id: CHAN, control_level: "MINORITY" }),
    ];
    const r = deriveClassification({ channelId: CHAN, relationships, entities, asOf: ASOF });
    expect(r.classification).toBe("EXTERNALLY_FUNDED");
  });
});

describe("deriveClassification — disputed", () => {
  it("is DISPUTED when a load-bearing owning edge has status DISPUTED", () => {
    const entities = [entity("co", "COMPANY", "Co")];
    const r = deriveClassification({
      channelId: CHAN,
      relationships: [
        rel({ type: "OWNS", from_entity_id: "co", to_entity_id: CHAN, status: "DISPUTED" }),
      ],
      entities,
      asOf: ASOF,
    });
    expect(r.classification).toBe("DISPUTED");
    expect(r.explanationCodes).toContain("OWNERSHIP_RELATIONSHIP_DISPUTED");
  });

  it("is DISPUTED when an UPWARD chain edge (not the owning edge) is DISPUTED", () => {
    // OWNS is active; the SUBSIDIARY_OF above the owner is disputed. This
    // exercises the upward-chain branch of rule 1, distinct from the
    // owning-edge branch above.
    const entities = [
      entity("pc", "COMPANY", "Production Co"),
      entity("mg", "COMPANY", "Media Group"),
    ];
    const relationships = [
      rel({ type: "OWNS", from_entity_id: "pc", to_entity_id: CHAN }),
      rel({ type: "SUBSIDIARY_OF", from_entity_id: "pc", to_entity_id: "mg", status: "DISPUTED" }),
    ];
    const r = deriveClassification({ channelId: CHAN, relationships, entities, asOf: ASOF });
    expect(r.classification).toBe("DISPUTED");
    expect(r.explanationCodes).toContain("OWNERSHIP_RELATIONSHIP_DISPUTED");
  });

  it("does NOT fire DISPUTED for a disputed edge disconnected from the ownership chain", () => {
    // A creator plainly owns the channel; a separate dispute between two
    // unrelated companies must not poison this channel's classification.
    const entities = [
      entity("creator", "CREATOR", "Creator"),
      entity("x", "COMPANY", "X"),
      entity("y", "COMPANY", "Y"),
    ];
    const relationships = [
      rel({ type: "OWNS", from_entity_id: "creator", to_entity_id: CHAN }),
      rel({
        type: "OWNS",
        from_entity_id: "x",
        to_entity_id: "y",
        control_level: "CONTROLLING",
        status: "DISPUTED",
      }),
    ];
    const r = deriveClassification({ channelId: CHAN, relationships, entities, asOf: ASOF });
    expect(r.classification).toBe("CREATOR_OWNED");
    expect(r.explanationCodes).not.toContain("OWNERSHIP_RELATIONSHIP_DISPUTED");
  });
});

describe("deriveClassification — expired ownership ignored", () => {
  it("ignores an OWNS edge whose effective_to is in the past", () => {
    const entities = [entity("co", "COMPANY", "Co")];
    const r = deriveClassification({
      channelId: CHAN,
      relationships: [
        rel({ type: "OWNS", from_entity_id: "co", to_entity_id: CHAN, effective_to: "2020-01-01" }),
      ],
      entities,
      asOf: ASOF,
    });
    expect(r.classification).toBe("OWNERSHIP_UNCLEAR");
    expect(r.explanationCodes).toContain("NO_OWNERSHIP_EVIDENCE");
  });
});

describe("deriveClassification — no evidence", () => {
  it("is OWNERSHIP_UNCLEAR with NO_OWNERSHIP_EVIDENCE when there are no active ownership edges", () => {
    const r = deriveClassification({
      channelId: CHAN,
      relationships: [],
      entities: [],
      asOf: ASOF,
    });
    expect(r.classification).toBe("OWNERSHIP_UNCLEAR");
    expect(r.explanationCodes).toContain("NO_OWNERSHIP_EVIDENCE");
    expect(r.directOwner).toBeNull();
    expect(r.ultimateParent).toBeNull();
  });
});

describe("deriveClassification — ambiguous direct owner", () => {
  it("is OWNERSHIP_UNCLEAR with MULTIPLE_OWNER_CANDIDATES on a tie", () => {
    const entities = [entity("a", "COMPANY"), entity("b", "COMPANY")];
    const r = deriveClassification({
      channelId: CHAN,
      relationships: [
        rel({ type: "OWNS", from_entity_id: "a", to_entity_id: CHAN, confidence: 0.8 }),
        rel({ type: "OWNS", from_entity_id: "b", to_entity_id: CHAN, confidence: 0.8 }),
      ],
      entities,
      asOf: ASOF,
    });
    expect(r.classification).toBe("OWNERSHIP_UNCLEAR");
    expect(r.explanationCodes).toContain("MULTIPLE_OWNER_CANDIDATES");
    expect(r.directOwner).toBeNull();
  });
});

describe("deriveClassification — joint creator ownership (smosh case)", () => {
  // Smosh-shaped fixture: two co-founders each hold an OWNS/CONTROLLING edge
  // into the channel at the same confidence — a tie among creator owners.
  const smoshEntities = [
    entity("padilla", "CREATOR", "Anthony Padilla"),
    entity("hecox", "CREATOR", "Ian Hecox"),
    entity("mythical", "COMPANY", "Mythical Entertainment"),
  ];
  const smoshRelationships = [
    rel({
      type: "OWNS",
      from_entity_id: "padilla",
      to_entity_id: CHAN,
      control_level: "CONTROLLING",
      confidence: 0.85,
    }),
    rel({
      type: "OWNS",
      from_entity_id: "hecox",
      to_entity_id: CHAN,
      control_level: "CONTROLLING",
      confidence: 0.85,
    }),
    rel({
      type: "PARTIALLY_OWNS",
      from_entity_id: "mythical",
      to_entity_id: CHAN,
      control_level: "MINORITY",
      confidence: 0.8,
    }),
  ];

  it("is CREATOR_OWNED with JOINTLY_CREATOR_OWNED when tied owners are all creators", () => {
    const r = deriveClassification({
      channelId: CHAN,
      relationships: smoshRelationships,
      entities: smoshEntities,
      asOf: ASOF,
    });
    expect(r.classification).toBe("CREATOR_OWNED");
    expect(r.explanationCodes).toContain("JOINTLY_CREATOR_OWNED");
  });

  it("returns all tied co-owners as directOwners (directOwner kept as one of them)", () => {
    const r = deriveClassification({
      channelId: CHAN,
      relationships: smoshRelationships,
      entities: smoshEntities,
      asOf: ASOF,
    });
    expect(r.directOwners.map((o) => o.id).sort()).toEqual(["hecox", "padilla"]);
    expect(r.directOwner).not.toBeNull();
    expect(["padilla", "hecox"]).toContain(r.directOwner!.id);
    expect(r.confidence).toBeCloseTo(0.85, 10);
  });

  it("also works for PERSON owners", () => {
    const r = deriveClassification({
      channelId: CHAN,
      relationships: [
        rel({ type: "OWNS", from_entity_id: "p1", to_entity_id: CHAN, confidence: 0.7 }),
        rel({ type: "OWNS", from_entity_id: "p2", to_entity_id: CHAN, confidence: 0.7 }),
      ],
      entities: [entity("p1", "PERSON", "Person One"), entity("p2", "PERSON", "Person Two")],
      asOf: ASOF,
    });
    expect(r.classification).toBe("CREATOR_OWNED");
    expect(r.explanationCodes).toContain("JOINTLY_CREATOR_OWNED");
  });

  it("remains OWNERSHIP_UNCLEAR for a MIXED-TYPE tie (company + person)", () => {
    const r = deriveClassification({
      channelId: CHAN,
      relationships: [
        rel({ type: "OWNS", from_entity_id: "co", to_entity_id: CHAN, confidence: 0.8 }),
        rel({ type: "OWNS", from_entity_id: "person", to_entity_id: CHAN, confidence: 0.8 }),
      ],
      entities: [entity("co", "COMPANY", "Co"), entity("person", "PERSON", "A Person")],
      asOf: ASOF,
    });
    expect(r.classification).toBe("OWNERSHIP_UNCLEAR");
    expect(r.explanationCodes).toContain("MULTIPLE_OWNER_CANDIDATES");
    expect(r.explanationCodes).not.toContain("JOINTLY_CREATOR_OWNED");
    expect(r.directOwner).toBeNull();
  });
});

describe("deriveClassification — cycle detection", () => {
  it("still classifies and reports OWNERSHIP_CYCLE_DETECTED", () => {
    const entities = [entity("pc", "COMPANY"), entity("mg", "COMPANY")];
    const relationships = [
      rel({ type: "OWNS", from_entity_id: "pc", to_entity_id: CHAN }),
      rel({ type: "SUBSIDIARY_OF", from_entity_id: "pc", to_entity_id: "mg" }),
      rel({ type: "SUBSIDIARY_OF", from_entity_id: "mg", to_entity_id: "pc" }),
    ];
    const r = deriveClassification({ channelId: CHAN, relationships, entities, asOf: ASOF });
    expect(r.classification).toBe("CORPORATE_OWNED");
    expect(r.explanationCodes).toContain("OWNERSHIP_CYCLE_DETECTED");
  });
});

describe("deriveClassification — warnings", () => {
  const entities = [entity("co", "COMPANY", "Co")];

  it("warns OWNERSHIP_CHANGED_RECENTLY when a chain edge is younger than 12 months", () => {
    const r = deriveClassification({
      channelId: CHAN,
      relationships: [
        rel({
          type: "OWNS",
          from_entity_id: "co",
          to_entity_id: CHAN,
          effective_from: monthsBefore(ASOF, 11),
        }),
      ],
      entities,
      asOf: ASOF,
    });
    expect(r.warnings).toContain("OWNERSHIP_CHANGED_RECENTLY");
  });

  it("does NOT warn at exactly the 12-month boundary", () => {
    const r = deriveClassification({
      channelId: CHAN,
      relationships: [
        rel({
          type: "OWNS",
          from_entity_id: "co",
          to_entity_id: CHAN,
          effective_from: monthsBefore(ASOF, 12),
        }),
      ],
      entities,
      asOf: ASOF,
    });
    expect(r.warnings).not.toContain("OWNERSHIP_CHANGED_RECENTLY");
  });

  it("warns RECORD_OUTDATED when lastReviewedAt is older than 12 months", () => {
    const r = deriveClassification({
      channelId: CHAN,
      relationships: [rel({ type: "OWNS", from_entity_id: "co", to_entity_id: CHAN })],
      entities,
      asOf: ASOF,
      lastReviewedAt: monthsBefore(ASOF, 18),
    });
    expect(r.warnings).toContain("RECORD_OUTDATED");
  });

  it("does not warn RECORD_OUTDATED for a fresh review", () => {
    const r = deriveClassification({
      channelId: CHAN,
      relationships: [rel({ type: "OWNS", from_entity_id: "co", to_entity_id: CHAN })],
      entities,
      asOf: ASOF,
      lastReviewedAt: monthsBefore(ASOF, 2),
    });
    expect(r.warnings).not.toContain("RECORD_OUTDATED");
  });
});
