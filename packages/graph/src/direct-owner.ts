import type { ExplanationCode, Relationship, RelationshipType } from "@channelwatch/schemas";

/**
 * Direct-owner resolution (task-3 brief; ownership rules v2). The direct owner
 * of a channel is the entity holding an active edge into the channel that
 * expresses ownership. As of rules v2 that edge set is widened from the bare
 * OWNS / ACQUIRED / CONTROLS trio to also include a PARTIALLY_OWNS or
 * INVESTED_IN edge that is a *majority* stake — i.e. `control_level` is
 * CONTROLLING OR `ownership_percentage` is strictly greater than 50. A
 * documented majority stake IS ownership; UNCLEAR is reserved for genuinely
 * undocumented cases. A minority / sub-majority PARTIALLY_OWNS or INVESTED_IN
 * edge is NOT ownership (it may still drive EXTERNALLY_FUNDED downstream).
 */

/**
 * Edge types that can express direct ownership of a channel, most-authoritative
 * first: OWNS > ACQUIRED > CONTROLS > PARTIALLY_OWNS > INVESTED_IN. The last two
 * only count when the specific edge is a majority stake (see `isOwnerEdge`).
 */
const OWNER_PRECEDENCE: Record<string, number> = {
  OWNS: 5,
  ACQUIRED: 4,
  CONTROLS: 3,
  PARTIALLY_OWNS: 2,
  INVESTED_IN: 1,
};

/** Types whose ownership only holds at a majority (controlling or >50%) stake. */
const MAJORITY_STAKE_TYPES: ReadonlySet<RelationshipType> = new Set([
  "PARTIALLY_OWNS",
  "INVESTED_IN",
]);

function ownerPrecedence(type: RelationshipType): number {
  return OWNER_PRECEDENCE[type] ?? 0;
}

/**
 * A stake is a *majority* stake when it is explicitly CONTROLLING or its
 * disclosed `ownership_percentage` is strictly greater than 50. The `> 50`
 * boundary is strict: exactly 50% does NOT qualify (precision over recall).
 */
function isMajorityStake(edge: Relationship): boolean {
  return (
    edge.control_level === "CONTROLLING" ||
    (edge.ownership_percentage !== null &&
      edge.ownership_percentage !== undefined &&
      edge.ownership_percentage > 50)
  );
}

/**
 * Whether an edge expresses direct channel ownership. OWNS/ACQUIRED/CONTROLS
 * always do; PARTIALLY_OWNS/INVESTED_IN do so only as a majority stake.
 */
function isOwnerEdge(edge: Relationship): boolean {
  if (ownerPrecedence(edge.type) === 0) return false;
  if (MAJORITY_STAKE_TYPES.has(edge.type)) return isMajorityStake(edge);
  return true;
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
  const owning = activeEdges.filter((e) => e.to_entity_id === channelId && isOwnerEdge(e));
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

  // A win on a widened PARTIALLY_OWNS/INVESTED_IN edge is a majority-stake
  // resolution, flagged so the label stays auditable ("owner from a majority
  // stake, not a bare OWNS edge").
  const explanationCodes: ExplanationCode[] = MAJORITY_STAKE_TYPES.has(best.type)
    ? ["DIRECT_OWNER_CONFIRMED", "MAJORITY_STAKE_OWNER"]
    : ["DIRECT_OWNER_CONFIRMED"];

  return {
    ownerId: best.from_entity_id,
    edge: best,
    ambiguous: false,
    tiedOwners: [best],
    explanationCodes,
  };
}
