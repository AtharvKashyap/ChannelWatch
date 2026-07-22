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
