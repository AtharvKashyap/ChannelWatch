import { describe, it, expect } from "vitest";
import { scoreClaimConfidence } from "../src/confidence.js";

describe("scoreClaimConfidence (SPEC §14.2)", () => {
  it("reproduces the worked example exactly: 0.884", () => {
    const result = scoreClaimConfidence({
      sourceQuality: 0.95,
      directness: 1.0,
      entityMatch: 0.98,
      recencyFactor: 0.95,
      corroborationFactor: 1.0,
      contradictionPenalty: 1.0,
    });
    expect(result).toBe(0.884);
  });

  it("is the product of all six factors, rounded to 3 decimals", () => {
    const result = scoreClaimConfidence({
      sourceQuality: 0.8,
      directness: 0.9,
      entityMatch: 0.9,
      recencyFactor: 0.9,
      corroborationFactor: 0.9,
      contradictionPenalty: 0.9,
    });
    // 0.8 * 0.9^5 = 0.472392 -> rounds to 0.472
    expect(result).toBe(0.472);
  });

  it("returns 0 when any factor is 0", () => {
    const result = scoreClaimConfidence({
      sourceQuality: 0.95,
      directness: 1.0,
      entityMatch: 0.98,
      recencyFactor: 0.95,
      corroborationFactor: 1.0,
      contradictionPenalty: 0,
    });
    expect(result).toBe(0);
  });

  it.each([
    ["sourceQuality", 1.5],
    ["directness", -0.1],
    ["entityMatch", 1.01],
    ["recencyFactor", -1],
    ["corroborationFactor", 2],
    ["contradictionPenalty", -0.5],
  ])("throws when %s is out of [0,1] range", (key, value) => {
    const factors = {
      sourceQuality: 0.9,
      directness: 0.9,
      entityMatch: 0.9,
      recencyFactor: 0.9,
      corroborationFactor: 0.9,
      contradictionPenalty: 0.9,
      [key]: value,
    };
    expect(() => scoreClaimConfidence(factors)).toThrow();
  });

  it("throws when a factor is NaN", () => {
    const factors = {
      sourceQuality: 0.9,
      directness: 0.9,
      entityMatch: 0.9,
      recencyFactor: 0.9,
      corroborationFactor: 0.9,
      contradictionPenalty: Number.NaN,
    };
    expect(() => scoreClaimConfidence(factors)).toThrow(/contradictionPenalty/);
  });

  it("accepts boundary values 0 and 1 without throwing", () => {
    expect(() =>
      scoreClaimConfidence({
        sourceQuality: 0,
        directness: 1,
        entityMatch: 0,
        recencyFactor: 1,
        corroborationFactor: 0,
        contradictionPenalty: 1,
      }),
    ).not.toThrow();
  });
});
