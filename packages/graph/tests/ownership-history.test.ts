import { describe, it, expect } from "vitest";
import { ownershipHistory } from "../src/ownership-history.js";
import { rel, entity, monthsBefore } from "./helpers.js";

/**
 * Tests for `ownershipHistory` (Track A). The function is pure and deterministic
 * (an explicit `asOf` drives `is_current`), producing an ordered list of
 * ownership periods from a channel's connected relationships — newest-first.
 */

const NOW = new Date("2026-07-23T00:00:00Z");

describe("ownershipHistory", () => {
  it("returns a single current period for one open-ended owner edge", () => {
    const history = ownershipHistory({
      channelId: "chan",
      relationships: [
        rel({
          type: "OWNS",
          from_entity_id: "owner",
          to_entity_id: "chan",
          control_level: "CONTROLLING",
          effective_from: "2020-01-01",
        }),
      ],
      entities: [entity("owner", "COMPANY", "Owner Co"), entity("chan", "CHANNEL", "The Channel")],
      asOf: NOW,
    });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      name: "Owner Co",
      entityType: "COMPANY",
      relationship: "OWNS",
      controlLevel: "CONTROLLING",
      ownershipPercentage: null,
      effectiveFrom: "2020-01-01",
      effectiveTo: null,
      isCurrent: true,
    });
  });

  it("orders multiple owners over time newest-first, marking only the current one", () => {
    const history = ownershipHistory({
      channelId: "chan",
      relationships: [
        // prior owner, superseded (ENDED, effective_to in the past)
        rel({
          type: "OWNS",
          from_entity_id: "old",
          to_entity_id: "chan",
          control_level: "CONTROLLING",
          effective_from: "2015-01-01",
          effective_to: "2021-06-01",
          status: "ENDED",
        }),
        // current owner, open-ended
        rel({
          type: "OWNS",
          from_entity_id: "new",
          to_entity_id: "chan",
          control_level: "CONTROLLING",
          effective_from: "2021-06-01",
        }),
      ],
      entities: [
        entity("old", "COMPANY", "Old Owner"),
        entity("new", "COMPANY", "New Owner"),
        entity("chan", "CHANNEL"),
      ],
      asOf: NOW,
    });
    expect(history.map((h) => h.name)).toEqual(["New Owner", "Old Owner"]);
    expect(history[0]!.isCurrent).toBe(true);
    expect(history[1]!.isCurrent).toBe(false);
    expect(history[1]!.effectiveTo).toBe("2021-06-01");
  });

  it("treats a null effective_from as an undisclosed date (sorted last) and null percentage", () => {
    const history = ownershipHistory({
      channelId: "chan",
      relationships: [
        rel({
          type: "OWNS",
          from_entity_id: "dated",
          to_entity_id: "chan",
          effective_from: "2022-01-01",
        }),
        rel({ type: "OWNS", from_entity_id: "undated", to_entity_id: "chan" }),
      ],
      entities: [
        entity("dated", "COMPANY", "Dated Owner"),
        entity("undated", "COMPANY", "Undated Owner"),
        entity("chan", "CHANNEL"),
      ],
      asOf: NOW,
    });
    // dated (2022) sorts before the undisclosed-date owner
    expect(history.map((h) => h.name)).toEqual(["Dated Owner", "Undated Owner"]);
    expect(history[1]!.effectiveFrom).toBeNull();
    expect(history.every((h) => h.ownershipPercentage === null)).toBe(true);
  });

  it("surfaces a disclosed ownership percentage when present", () => {
    const history = ownershipHistory({
      channelId: "chan",
      relationships: [
        rel({
          type: "OWNS",
          from_entity_id: "owner",
          to_entity_id: "chan",
          control_level: "CONTROLLING",
          ownership_percentage: 75,
          effective_from: "2021-11-04",
        }),
      ],
      entities: [entity("owner", "COMPANY", "Owner Co"), entity("chan", "CHANNEL")],
      asOf: NOW,
    });
    expect(history[0]!.ownershipPercentage).toBe(75);
  });

  it("includes a creator founding edge (FOUNDED_BY resolves the founder as the entity)", () => {
    const history = ownershipHistory({
      channelId: "chan",
      relationships: [
        rel({
          type: "FOUNDED_BY",
          from_entity_id: "chan",
          to_entity_id: "creator",
          effective_from: "2011-01-01",
        }),
      ],
      entities: [entity("creator", "CREATOR", "Jane Creator"), entity("chan", "CHANNEL")],
      asOf: NOW,
    });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      name: "Jane Creator",
      entityType: "CREATOR",
      relationship: "FOUNDED_BY",
    });
  });

  it("walks a multi-hop chain (channel <- Moonbug <- Candle Media)", () => {
    const history = ownershipHistory({
      channelId: "chan",
      relationships: [
        rel({
          type: "OWNS",
          from_entity_id: "moonbug",
          to_entity_id: "chan",
          control_level: "CONTROLLING",
        }),
        rel({
          type: "OWNS",
          from_entity_id: "candle",
          to_entity_id: "moonbug",
          control_level: "CONTROLLING",
          ownership_percentage: 75,
          effective_from: "2021-11-04",
        }),
      ],
      entities: [
        entity("moonbug", "COMPANY", "Moonbug Entertainment"),
        entity("candle", "COMPANY", "Candle Media"),
        entity("chan", "CHANNEL"),
      ],
      asOf: NOW,
    });
    // both hops are surfaced; Candle (dated 2021) sorts above the undated Moonbug edge
    expect(history.map((h) => h.name)).toEqual(["Candle Media", "Moonbug Entertainment"]);
  });

  it("excludes non-ownership edges such as HOSTED_BY", () => {
    const history = ownershipHistory({
      channelId: "chan",
      relationships: [
        rel({ type: "OWNS", from_entity_id: "owner", to_entity_id: "chan" }),
        rel({ type: "HOSTED_BY", from_entity_id: "chan", to_entity_id: "host" }),
      ],
      entities: [
        entity("owner", "COMPANY", "Owner Co"),
        entity("host", "CREATOR", "Host Person"),
        entity("chan", "CHANNEL"),
      ],
      asOf: NOW,
    });
    expect(history.map((h) => h.name)).toEqual(["Owner Co"]);
  });

  it("FORMERLY_OWNED_BY (subject=channel) surfaces the prior owner and is never current", () => {
    const history = ownershipHistory({
      channelId: "chan",
      relationships: [
        rel({
          type: "FORMERLY_OWNED_BY",
          from_entity_id: "chan",
          to_entity_id: "prior",
          control_level: "CONTROLLING",
          effective_from: "2011-01-01",
          effective_to: "2018-11-01",
          status: "ENDED",
        }),
      ],
      entities: [entity("prior", "COMPANY", "Prior Owner"), entity("chan", "CHANNEL")],
      asOf: NOW,
    });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      name: "Prior Owner",
      relationship: "FORMERLY_OWNED_BY",
      isCurrent: false,
      effectiveTo: "2018-11-01",
    });
  });

  it("marks an ENDED edge with no effective_to as not current (superseded)", () => {
    const history = ownershipHistory({
      channelId: "chan",
      relationships: [
        rel({
          type: "OWNS",
          from_entity_id: "gone",
          to_entity_id: "chan",
          status: "ENDED",
        }),
      ],
      entities: [entity("gone", "COMPANY", "Gone Owner"), entity("chan", "CHANNEL")],
      asOf: NOW,
    });
    expect(history[0]!.isCurrent).toBe(false);
  });

  it("marks a future-dated edge as not current", () => {
    const future = monthsBefore(NOW, -6); // six months AFTER now
    const history = ownershipHistory({
      channelId: "chan",
      relationships: [
        rel({ type: "OWNS", from_entity_id: "later", to_entity_id: "chan", effective_from: future }),
      ],
      entities: [entity("later", "COMPANY", "Later Owner"), entity("chan", "CHANNEL")],
      asOf: NOW,
    });
    expect(history[0]!.isCurrent).toBe(false);
  });

  it("does not leak a sibling channel's edges through a shared upstream owner", () => {
    const history = ownershipHistory({
      channelId: "chan",
      relationships: [
        rel({ type: "OWNS", from_entity_id: "pe", to_entity_id: "chan" }),
        // the same PE owns an unrelated sibling channel
        rel({ type: "OWNS", from_entity_id: "pe", to_entity_id: "sibling" }),
      ],
      entities: [
        entity("pe", "PRIVATE_EQUITY_FIRM", "Big Capital"),
        entity("chan", "CHANNEL"),
        entity("sibling", "CHANNEL", "Sibling Channel"),
      ],
      asOf: NOW,
    });
    // only the edge that owns THIS channel is surfaced; the sibling edge is not
    expect(history.map((h) => h.name)).toEqual(["Big Capital"]);
  });

  it("leaves name/entityType null when the owner entity is not resolvable", () => {
    const history = ownershipHistory({
      channelId: "chan",
      relationships: [rel({ type: "OWNS", from_entity_id: "ghost", to_entity_id: "chan" })],
      entities: [entity("chan", "CHANNEL")],
      asOf: NOW,
    });
    expect(history[0]!.name).toBeUndefined();
    expect(history[0]!.entityType).toBeNull();
  });

  it("is empty when there are no ownership/control/founding edges", () => {
    const history = ownershipHistory({
      channelId: "chan",
      relationships: [rel({ type: "HOSTED_BY", from_entity_id: "chan", to_entity_id: "host" })],
      entities: [entity("host", "CREATOR"), entity("chan", "CHANNEL")],
      asOf: NOW,
    });
    expect(history).toEqual([]);
  });
});
