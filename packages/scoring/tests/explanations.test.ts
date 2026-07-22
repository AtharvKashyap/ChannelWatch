import { describe, it, expect } from "vitest";
import { explainConfidence } from "../src/explanations.js";

const factors = {
  sourceQuality: 0.95,
  directness: 1.0,
  entityMatch: 0.98,
  recencyFactor: 0.95,
  corroborationFactor: 1.0,
  contradictionPenalty: 1.0,
};

describe("explainConfidence", () => {
  it("returns an array of neutral, template-built strings", () => {
    const lines = explainConfidence(factors, "OFFICIAL_ACQUISITION_ANNOUNCEMENT");
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(typeof line).toBe("string");
    }
  });

  it("mentions the source type in neutral, fixed phrasing", () => {
    const lines = explainConfidence(factors, "ANONYMOUS_TIP");
    expect(lines.join(" ")).toMatch(/anonymous tip/i);
  });

  it("flags a low recency factor with a staleness note", () => {
    const lines = explainConfidence({ ...factors, recencyFactor: 0.2 }, "ANONYMOUS_TIP");
    expect(lines.join(" ")).toMatch(/recent|stale|outdated/i);
  });

  it("flags a contradiction penalty below 1 with a conflict note", () => {
    const lines = explainConfidence({ ...factors, contradictionPenalty: 0.5 }, "ANONYMOUS_TIP");
    expect(lines.join(" ")).toMatch(/contradict/i);
  });
});
