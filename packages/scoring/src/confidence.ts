/**
 * Inputs to the SPEC §14.2 claim confidence formula. Each factor is a
 * multiplier in [0, 1]; values outside that range are invalid input, not a
 * modeling decision, so `scoreClaimConfidence` throws rather than clamping.
 */
export interface ConfidenceFactors {
  /** Weight of the evidencing source (see `EVIDENCE_WEIGHTS`, §14.1). */
  sourceQuality: number;
  /** How directly the source states ownership vs. merely implies it. */
  directness: number;
  /** Quality of the match between the source's subject and the channel/entity. */
  entityMatch: number;
  /** Decay factor for how stale the evidence is. */
  recencyFactor: number;
  /** Boost from independent corroborating sources. */
  corroborationFactor: number;
  /** Reduction applied when contradicting evidence exists. */
  contradictionPenalty: number;
}

const FACTOR_KEYS = [
  "sourceQuality",
  "directness",
  "entityMatch",
  "recencyFactor",
  "corroborationFactor",
  "contradictionPenalty",
] as const satisfies readonly (keyof ConfidenceFactors)[];

function assertUnitRange(key: string, value: number): void {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 1) {
    throw new RangeError(`ConfidenceFactors.${key} must be within [0, 1], got ${value}`);
  }
}

/**
 * Computes claim confidence per SPEC §14.2:
 *
 *   claim_confidence =
 *       source_quality × directness × entity_match
 *       × recency_factor × corroboration_factor × contradiction_penalty
 *
 * Every factor must be in [0, 1]; out-of-range input throws. The result is
 * rounded to 3 decimal places, matching the worked example (0.884).
 */
export function scoreClaimConfidence(factors: ConfidenceFactors): number {
  for (const key of FACTOR_KEYS) {
    assertUnitRange(key, factors[key]);
  }

  const product = FACTOR_KEYS.reduce((acc, key) => acc * factors[key], 1);
  return Math.round(product * 1000) / 1000;
}
