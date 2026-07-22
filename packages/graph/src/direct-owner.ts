import type { ExplanationCode, Relationship, RelationshipType } from "@channelwatch/schemas";

/**
 * Direct-owner resolution (task-3 brief). The direct owner of a channel is the
 * entity holding an active OWNS / ACQUIRED / CONTROLS edge into the channel.
 */

/** Edge types that can express direct ownership of a channel, most-authoritative first. */
const OWNER_PRECEDENCE: Record<string, number> = {
  OWNS: 3,
  ACQUIRED: 2,
  CONTROLS: 1,
};

function ownerPrecedence(type: RelationshipType): number {
  return OWNER_PRECEDENCE[type] ?? 0;
}

export interface DirectOwnerResult {
  /** Resolved owner entity id, or null when there is no owner or the result is ambiguous. */
  ownerId: string | null;
  /** The load-bearing owning edge chosen, or null. */
  edge: Relationship | null;
  /** True when candidate owners tie and no single owner can be picked. */
  ambiguous: boolean;
  /**
   * The best owning edge per distinct owner that tied at the top
   * precedence+confidence, sorted deterministically by `from_entity_id`. On a
   * tie this holds every tied owner (length >= 2) so a caller with entity-type
   * knowledge can resolve joint ownership (e.g. all-creator co-ownership). On an
   * unambiguous resolution it holds the single winning edge; empty when there is
   * no owner.
   */
  tiedOwners: Relationship[];
  explanationCodes: ExplanationCode[];
}

/**
 * Resolve the direct owner from a set of already-ACTIVE edges.
 *
 * Rules (brief): consider active OWNS/ACQUIRED/CONTROLS edges whose target is
 * the channel. Apply type precedence OWNS > ACQUIRED > CONTROLS — only the
 * highest-precedence type present is considered. Within that type, the
 * highest-confidence edge wins. If the two best distinct owners tie on
 * confidence, the answer is UNKNOWN (ownerId null) with MULTIPLE_OWNER_CANDIDATES
 * — precision over recall, never a guess. Multiple edges pointing at the *same*
 * owner are not a tie.
 */
export function findDirectOwner(channelId: string, activeEdges: Relationship[]): DirectOwnerResult {
  const owning = activeEdges.filter(
    (e) => e.to_entity_id === channelId && ownerPrecedence(e.type) > 0,
  );
  if (owning.length === 0) {
    return { ownerId: null, edge: null, ambiguous: false, tiedOwners: [], explanationCodes: [] };
  }

  const topPrecedence = Math.max(...owning.map((e) => ownerPrecedence(e.type)));
  const contenders = owning.filter((e) => ownerPrecedence(e.type) === topPrecedence);

  // Best edge per distinct owner (highest confidence).
  const bestByOwner = new Map<string, Relationship>();
  for (const edge of contenders) {
    const current = bestByOwner.get(edge.from_entity_id);
    if (!current || edge.confidence > current.confidence) {
      bestByOwner.set(edge.from_entity_id, edge);
    }
  }

  const owners = [...bestByOwner.values()].sort((a, b) => b.confidence - a.confidence);
  const best = owners[0];
  if (!best) {
    return { ownerId: null, edge: null, ambiguous: false, tiedOwners: [], explanationCodes: [] };
  }

  // Every distinct owner whose best edge ties the top confidence. Sorted by
  // `from_entity_id` so the tie set (and any representative a caller picks from
  // it) is deterministic regardless of input edge order.
  const tiedOwners = owners
    .filter((o) => o.confidence === best.confidence)
    .sort((a, b) => a.from_entity_id.localeCompare(b.from_entity_id));

  if (tiedOwners.length > 1) {
    return {
      ownerId: null,
      edge: null,
      ambiguous: true,
      tiedOwners,
      explanationCodes: ["MULTIPLE_OWNER_CANDIDATES"],
    };
  }

  return {
    ownerId: best.from_entity_id,
    edge: best,
    ambiguous: false,
    tiedOwners: [best],
    explanationCodes: ["DIRECT_OWNER_CONFIRMED"],
  };
}
