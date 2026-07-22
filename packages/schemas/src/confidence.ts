import type { ConfidenceLabel } from "./enums.js";

/**
 * Minimum score for a claim to be publicly publishable (SPEC §14.3).
 * Scores below this are "Research Lead Only" — not published to users.
 */
export const PUBLICATION_THRESHOLD = 0.3;

/**
 * Derives a confidence label from a numeric confidence score per SPEC §14.3:
 *
 *   0.90–1.00  Confirmed
 *   0.75–0.89  High Confidence
 *   0.55–0.74  Moderate Confidence
 *   0.30–0.54  Low Confidence
 *   0.00–0.29  Research Lead Only  → UNKNOWN (not publishable)
 *
 * Note: DISPUTED (§8.1) is a conflict state set by review, not a band derived
 * from a score, so it is never returned here.
 */
export function confidenceLabelFromScore(score: number): ConfidenceLabel {
  if (score >= 0.9) return "CONFIRMED";
  if (score >= 0.75) return "HIGH";
  if (score >= 0.55) return "MODERATE";
  if (score >= PUBLICATION_THRESHOLD) return "LOW";
  return "UNKNOWN";
}

/**
 * Local cache time-to-live values in milliseconds (SPEC §18.6).
 */
export const CACHE_TTLS = {
  /** Confirmed record: 7 days. */
  confirmed: 7 * 24 * 60 * 60 * 1000,
  /** Recently changed record: 6 hours. */
  recentlyChanged: 6 * 60 * 60 * 1000,
  /** Unknown channel: 24 hours. */
  unknown: 24 * 60 * 60 * 1000,
  /** API error: 10 minutes. */
  apiError: 10 * 60 * 1000,
  /** Disputed record: 1 hour. */
  disputed: 60 * 60 * 1000,
} as const;
