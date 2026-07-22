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
  /**
   * Identifies the publisher/outlet; two sources are "independent" when this
   * differs. May be absent (null/undefined/blank) when the source did not record
   * a publisher — a publisher-less Tier 2 source cannot be attributed to an
   * outlet and therefore never counts toward the two-independent-publishers
   * requirement. Callers MUST NOT substitute a title or url here: those are not
   * publisher identities, and doing so would let two anonymous sources with
   * different titles masquerade as two independent publishers.
   */
  publisher?: string | null;
}

/**
 * Implements SPEC §14.3's rule for publicly visible PE-backed labels:
 *
 *   - at least one Tier 1 source, OR
 *   - two (or more) Tier 2 sources from independent (different) publishers.
 *
 * Tier 3 and Tier 4 sources never satisfy this rule on their own.
 *
 * Publisher strings are normalized (trimmed + lowercased) before the
 * independence comparison, so "Forbes" and " forbes " count as the SAME
 * publisher rather than two independent ones — closing a loophole where casing
 * or whitespace differences would spuriously satisfy the two-independent-source
 * rule.
 *
 * A Tier 2 source with no publisher (null/undefined/blank after trimming) is
 * NOT counted as an independent publisher: we cannot know two anonymous sources
 * are from different outlets, so they must not satisfy the rule. The Tier 1
 * short-circuit is unaffected — a Tier 1 source qualifies regardless of publisher.
 */
export function canPublishPeLabel(sources: readonly PeLabelSource[]): boolean {
  if (sources.some((source) => source.tier === 1)) {
    return true;
  }

  const independentTier2Publishers = new Set(
    sources
      .filter((source) => source.tier === 2)
      .map((source) => source.publisher?.trim().toLowerCase() ?? "")
      .filter((publisher) => publisher.length > 0),
  );

  return independentTier2Publishers.size >= 2;
}
