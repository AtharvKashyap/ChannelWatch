import { describe, it, expect } from "vitest";
import { findDirectOwner } from "../src/direct-owner.js";
import { rel } from "./helpers.js";

const CHAN = "chan";

describe("findDirectOwner", () => {
  it("returns the entity with an active OWNS edge into the channel", () => {
    const r = findDirectOwner(CHAN, [
      rel({ type: "OWNS", from_entity_id: "pc", to_entity_id: CHAN }),
    ]);
    expect(r.ownerId).toBe("pc");
    expect(r.edge?.type).toBe("OWNS");
    expect(r.ambiguous).toBe(false);
    expect(r.explanationCodes).toContain("DIRECT_OWNER_CONFIRMED");
  });

  it("prefers OWNS over ACQUIRED over CONTROLS regardless of confidence", () => {
    const r = findDirectOwner(CHAN, [
      rel({ type: "CONTROLS", from_entity_id: "c", to_entity_id: CHAN, confidence: 0.99 }),
      rel({ type: "ACQUIRED", from_entity_id: "b", to_entity_id: CHAN, confidence: 0.98 }),
      rel({ type: "OWNS", from_entity_id: "a", to_entity_id: CHAN, confidence: 0.5 }),
    ]);
    expect(r.ownerId).toBe("a");
    expect(r.edge?.type).toBe("OWNS");
  });

  it("breaks a same-type multi-owner situation by highest confidence", () => {
    const r = findDirectOwner(CHAN, [
      rel({ type: "OWNS", from_entity_id: "a", to_entity_id: CHAN, confidence: 0.6 }),
      rel({ type: "OWNS", from_entity_id: "b", to_entity_id: CHAN, confidence: 0.9 }),
    ]);
    expect(r.ownerId).toBe("b");
    expect(r.ambiguous).toBe(false);
  });

  it("returns UNKNOWN with MULTIPLE_OWNER_CANDIDATES on a true tie", () => {
    const r = findDirectOwner(CHAN, [
      rel({ type: "OWNS", from_entity_id: "a", to_entity_id: CHAN, confidence: 0.8 }),
      rel({ type: "OWNS", from_entity_id: "b", to_entity_id: CHAN, confidence: 0.8 }),
    ]);
    expect(r.ownerId).toBeNull();
    expect(r.ambiguous).toBe(true);
    expect(r.explanationCodes).toContain("MULTIPLE_OWNER_CANDIDATES");
  });

  it("is not a tie when multiple owning edges point at the same owner", () => {
    const r = findDirectOwner(CHAN, [
      rel({ type: "OWNS", from_entity_id: "a", to_entity_id: CHAN, confidence: 0.8 }),
      rel({ type: "ACQUIRED", from_entity_id: "a", to_entity_id: CHAN, confidence: 0.8 }),
    ]);
    expect(r.ownerId).toBe("a");
    expect(r.ambiguous).toBe(false);
  });

  it("returns no owner when there are no owning edges into the channel", () => {
    const r = findDirectOwner(CHAN, [
      rel({ type: "FUNDS", from_entity_id: "vc", to_entity_id: CHAN }),
    ]);
    expect(r.ownerId).toBeNull();
    expect(r.ambiguous).toBe(false);
  });
});

describe("findDirectOwner — owner-edge widening (ownership rules v2)", () => {
  it("treats a CONTROLLING PARTIALLY_OWNS stake as ownership, with MAJORITY_STAKE_OWNER", () => {
    const r = findDirectOwner(CHAN, [
      rel({
        type: "PARTIALLY_OWNS",
        from_entity_id: "firm",
        to_entity_id: CHAN,
        control_level: "CONTROLLING",
      }),
    ]);
    expect(r.ownerId).toBe("firm");
    expect(r.edge?.type).toBe("PARTIALLY_OWNS");
    expect(r.explanationCodes).toContain("MAJORITY_STAKE_OWNER");
  });

  it("treats a >50% PARTIALLY_OWNS stake as ownership even when control_level is UNKNOWN", () => {
    const r = findDirectOwner(CHAN, [
      rel({
        type: "PARTIALLY_OWNS",
        from_entity_id: "firm",
        to_entity_id: CHAN,
        control_level: "UNKNOWN",
        ownership_percentage: 50.1,
      }),
    ]);
    expect(r.ownerId).toBe("firm");
    expect(r.explanationCodes).toContain("MAJORITY_STAKE_OWNER");
  });

  it("treats a majority INVESTED_IN stake as ownership", () => {
    const r = findDirectOwner(CHAN, [
      rel({
        type: "INVESTED_IN",
        from_entity_id: "firm",
        to_entity_id: CHAN,
        control_level: "CONTROLLING",
      }),
    ]);
    expect(r.ownerId).toBe("firm");
    expect(r.edge?.type).toBe("INVESTED_IN");
    expect(r.explanationCodes).toContain("MAJORITY_STAKE_OWNER");
  });

  it(">50% boundary: exactly 50% does NOT qualify as ownership", () => {
    const r = findDirectOwner(CHAN, [
      rel({
        type: "PARTIALLY_OWNS",
        from_entity_id: "firm",
        to_entity_id: CHAN,
        control_level: "MINORITY",
        ownership_percentage: 50,
      }),
    ]);
    expect(r.ownerId).toBeNull();
  });

  it(">50% boundary: 50.1% DOES qualify as ownership", () => {
    const r = findDirectOwner(CHAN, [
      rel({
        type: "PARTIALLY_OWNS",
        from_entity_id: "firm",
        to_entity_id: CHAN,
        control_level: "MINORITY",
        ownership_percentage: 50.1,
      }),
    ]);
    expect(r.ownerId).toBe("firm");
  });

  it("a non-controlling, sub-majority INVESTED_IN edge is NOT an owner edge", () => {
    const r = findDirectOwner(CHAN, [
      rel({
        type: "INVESTED_IN",
        from_entity_id: "vc",
        to_entity_id: CHAN,
        control_level: "MINORITY",
      }),
    ]);
    expect(r.ownerId).toBeNull();
  });

  it("prefers OWNS over a majority PARTIALLY_OWNS, and PARTIALLY_OWNS over INVESTED_IN", () => {
    const r = findDirectOwner(CHAN, [
      rel({
        type: "INVESTED_IN",
        from_entity_id: "i",
        to_entity_id: CHAN,
        control_level: "CONTROLLING",
        confidence: 0.99,
      }),
      rel({
        type: "PARTIALLY_OWNS",
        from_entity_id: "p",
        to_entity_id: CHAN,
        control_level: "CONTROLLING",
        confidence: 0.98,
      }),
      rel({ type: "OWNS", from_entity_id: "o", to_entity_id: CHAN, confidence: 0.5 }),
    ]);
    expect(r.ownerId).toBe("o");
    // A bare OWNS win is a direct confirmation, not a majority-stake resolution.
    expect(r.explanationCodes).toContain("DIRECT_OWNER_CONFIRMED");
    expect(r.explanationCodes).not.toContain("MAJORITY_STAKE_OWNER");
  });

  it("PARTIALLY_OWNS beats INVESTED_IN when both are majority stakes", () => {
    const r = findDirectOwner(CHAN, [
      rel({
        type: "INVESTED_IN",
        from_entity_id: "i",
        to_entity_id: CHAN,
        control_level: "CONTROLLING",
        confidence: 0.99,
      }),
      rel({
        type: "PARTIALLY_OWNS",
        from_entity_id: "p",
        to_entity_id: CHAN,
        control_level: "CONTROLLING",
        confidence: 0.5,
      }),
    ]);
    expect(r.ownerId).toBe("p");
    expect(r.explanationCodes).toContain("MAJORITY_STAKE_OWNER");
  });
});
