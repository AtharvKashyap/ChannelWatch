import { describe, it, expect } from "vitest";
import { isTimeValid, isActive, buildOwnershipGraph } from "../src/graph.js";
import { rel } from "./helpers.js";

const ASOF = new Date("2026-07-21T00:00:00Z");

describe("isTimeValid", () => {
  it("is true when effective_to is null (open-ended)", () => {
    expect(isTimeValid(rel({ type: "OWNS", effective_to: null }), ASOF)).toBe(true);
  });

  it("is true when effective_to is in the future", () => {
    expect(isTimeValid(rel({ type: "OWNS", effective_to: "2030-01-01" }), ASOF)).toBe(true);
  });

  it("is false when effective_to is in the past (expired/superseded)", () => {
    expect(isTimeValid(rel({ type: "OWNS", effective_to: "2020-01-01" }), ASOF)).toBe(false);
  });

  it("is false when effective_from is in the future (not yet in force)", () => {
    expect(isTimeValid(rel({ type: "OWNS", effective_from: "2030-01-01" }), ASOF)).toBe(false);
  });
});

describe("isActive", () => {
  it("requires status ACTIVE", () => {
    expect(isActive(rel({ type: "OWNS", status: "ACTIVE" }), ASOF)).toBe(true);
    expect(isActive(rel({ type: "OWNS", status: "ENDED" }), ASOF)).toBe(false);
    expect(isActive(rel({ type: "OWNS", status: "DISPUTED" }), ASOF)).toBe(false);
    expect(isActive(rel({ type: "OWNS", status: "PENDING_REVIEW" }), ASOF)).toBe(false);
  });

  it("requires the time window to be current", () => {
    expect(
      isActive(rel({ type: "OWNS", status: "ACTIVE", effective_to: "2020-01-01" }), ASOF),
    ).toBe(false);
  });
});

describe("buildOwnershipGraph", () => {
  it("keeps only active edges and indexes them by endpoint", () => {
    const edges = [
      rel({ type: "OWNS", from_entity_id: "pc", to_entity_id: "chan" }),
      rel({ type: "OWNS", from_entity_id: "old", to_entity_id: "chan", status: "ENDED" }),
      rel({ type: "SUBSIDIARY_OF", from_entity_id: "pc", to_entity_id: "mg" }),
    ];
    const g = buildOwnershipGraph(edges, ASOF);
    expect(g.activeEdges).toHaveLength(2);
    expect(g.edgesByTo.get("chan")).toHaveLength(1);
    expect(g.edgesByFrom.get("pc")).toHaveLength(2);
  });
});
