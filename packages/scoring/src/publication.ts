import { PUBLICATION_THRESHOLD, type SourceTier } from "@channelwatch/schemas";

/**
 * Whether a claim's confidence score meets the SPEC §14.3 publication
 * threshold for public visibility. Below this, claims stay "Research Lead
 * Only" and are not shown to users.
 */
export function isPublishable(confidence: number): boolean {
  return confidence >= PUBLICATION_THRESHOLD;
}

/** A single source's tier and publisher, as required by the §14.3 PE-label rule. */
export interface PeLabelSource {
  tier: SourceTier;
  /** Identifies the publisher/outlet; two sources are "independent" when this differs. */
  publisher: string;
}

/**
 * Implements SPEC §14.3's rule for publicly visible PE-backed labels:
 *
 *   - at least one Tier 1 source, OR
 *   - two (or more) Tier 2 sources from independent (different) publishers.
 *
 * Tier 3 and Tier 4 sources never satisfy this rule on their own.
 */
export function canPublishPeLabel(sources: readonly PeLabelSource[]): boolean {
  if (sources.some((source) => source.tier === 1)) {
    return true;
  }

  const independentTier2Publishers = new Set(
    sources.filter((source) => source.tier === 2).map((source) => source.publisher),
  );

  return independentTier2Publishers.size >= 2;
}
