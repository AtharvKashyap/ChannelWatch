import { describe, it, expect } from "vitest";
import { findUltimateParent } from "../src/ultimate-parent.js";
import { rel } from "./helpers.js";

describe("findUltimateParent", () => {
  it("follows SUBSIDIARY_OF then PORTFOLIO_COMPANY_OF to the top", () => {
    const r = findUltimateParent("pc", [
      rel({ type: "SUBSIDIARY_OF", from_entity_id: "pc", to_entity_id: "mg" }),
      rel({ type: "PORTFOLIO_COMPANY_OF", from_entity_id: "mg", to_entity_id: "pe" }),
    ]);
    expect(r.ultimateParentId).toBe("pe");
    expect(r.chain.map((e) => e.type)).toEqual(["SUBSIDIARY_OF", "PORTFOLIO_COMPANY_OF"]);
    expect(r.cycleDetected).toBe(false);
  });

  it("follows a controlling OWNS edge upward (parent OWNS current)", () => {
    const r = findUltimateParent("sub", [
      rel({
        type: "OWNS",
        from_entity_id: "parent",
        to_entity_id: "sub",
        control_level: "CONTROLLING",
      }),
    ]);
    expect(r.ultimateParentId).toBe("parent");
  });

  it("ignores a non-controlling PARTIALLY_OWNS edge", () => {
    const r = findUltimateParent("sub", [
      rel({
        type: "PARTIALLY_OWNS",
        from_entity_id: "inv",
        to_entity_id: "sub",
        control_level: "MINORITY",
      }),
    ]);
    expect(r.ultimateParentId).toBe("sub");
    expect(r.chain).toHaveLength(0);
  });

  it("returns the owner itself when it has no parent", () => {
    const r = findUltimateParent("solo", []);
    expect(r.ultimateParentId).toBe("solo");
    expect(r.chain).toHaveLength(0);
  });

  it("is cycle-safe and reports OWNERSHIP_CYCLE_DETECTED", () => {
    const r = findUltimateParent("a", [
      rel({ type: "SUBSIDIARY_OF", from_entity_id: "a", to_entity_id: "b" }),
      rel({ type: "SUBSIDIARY_OF", from_entity_id: "b", to_entity_id: "a" }),
    ]);
    expect(r.cycleDetected).toBe(true);
    expect(r.explanationCodes).toContain("OWNERSHIP_CYCLE_DETECTED");
    // chain-so-far is returned rather than looping forever
    expect(r.chain.length).toBeGreaterThanOrEqual(1);
  });
});
