import type { Entity, EntityType, Relationship, RelationshipType } from "@channelwatch/schemas";
import { isTimeValid } from "./graph.js";

/**
 * Temporal ownership history (Track A). A pure function producing an ordered list
 * of ownership *periods* for a channel from its connected relationships — no I/O,
 * no clock. Time-dependence is expressed through the explicit `asOf: Date` so the
 * same inputs always produce the same output (the founding determinism rule of
 * this library; never call Date.now() here).
 *
 * Unlike `deriveClassification` (which reads only ACTIVE, currently-valid edges
 * to serve the CURRENT label), this surfaces the full history: superseded prior
 * owners (an ownership edge whose `effective_to` is in the past or whose status
 * is ENDED) are INCLUDED, marked `isCurrent: false`. History never changes the
 * served classification.
 */

/**
 * Ownership/control/founding edge types that constitute an ownership period
 * (Track A spec §1). Non-ownership edges (e.g. HOSTED_BY) are excluded — they
 * remain on the fuller `/timeline` stream.
 *
 * `OWNER_FROM_TYPES` are directed owner→owned (the subject holds the object):
 * the owner is `from`, the owned node is `to`.
 */
const OWNER_FROM_TYPES: ReadonlySet<RelationshipType> = new Set([
  "OWNS",
  "PARTIALLY_OWNS",
  "ACQUIRED",
  "INVESTED_IN",
  "CONTROLS",
]);

/**
 * Edges directed owned→owner (the subject is the channel/entity; the object is
 * the founder or prior owner): the owned node is `from`, the owner is `to`.
 * `FORMERLY_OWNED_BY` is included as an explicitly-prior ownership edge so
 * history is complete for records that model a transition with that legacy type
 * (the going-forward convention instead sets `effective_to` on a superseded
 * OWNS/ACQUIRED edge — either shape is surfaced).
 */
const OWNER_TO_TYPES: ReadonlySet<RelationshipType> = new Set(["FOUNDED_BY", "FORMERLY_OWNED_BY"]);

/** The owner (higher) and owned (lower) endpoints of one ownership/founding edge. */
function endpointsOf(edge: Relationship): { owner: string; owned: string } | null {
  if (OWNER_FROM_TYPES.has(edge.type)) {
    return { owner: edge.from_entity_id, owned: edge.to_entity_id };
  }
  if (OWNER_TO_TYPES.has(edge.type)) {
    return { owner: edge.to_entity_id, owned: edge.from_entity_id };
  }
  return null;
}

function toTime(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * One ownership period surfaced by `ownershipHistory`, in the same camelCase
 * display shape family as `OwnershipChainStep`. `entityId` is the owner/founder
 * node; `name`/`entityType` are resolved from the `entities` input (undefined /
 * null when not resolvable). The API assembler maps this to the snake_case
 * `OwnershipHistoryEntry` payload shape.
 */
export interface OwnershipHistoryEntry {
  entityId: string;
  name?: string;
  entityType: EntityType | null;
  relationship: RelationshipType;
  controlLevel: Relationship["control_level"];
  ownershipPercentage: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  /** The period covers `asOf` and is not superseded (open-ended and not ENDED). */
  isCurrent: boolean;
}

export interface OwnershipHistoryInput {
  channelId: string;
  relationships: Relationship[];
  entities: Entity[];
  /** Explicit evaluation date — determinism requires this be passed, never the clock. */
  asOf: Date;
}

/**
 * Build the channel's ownership history, newest-first.
 *
 * Scope: an upward walk from the channel over ownership/founding edges. Starting
 * from the channel, any edge whose *owned* endpoint is reachable is included and
 * its *owner* endpoint becomes reachable in turn — so the channel's direct owners
 * and every upstream owner-of-an-owner are surfaced (a multi-hop chain), while a
 * sibling channel that merely shares an upstream owner is NOT (its edge's owned
 * endpoint is never reachable). Both current and superseded edges are considered
 * for membership; `isCurrent` distinguishes them.
 *
 * `isCurrent` = the edge's time window covers `asOf` AND it is not ENDED. A past
 * `effective_to` or an ENDED status marks the period as a prior (superseded) one.
 *
 * Ordering: newest-first by `effective_from` (descending); undated periods sort
 * last (their position is unknown, never inferred), ties broken by name for a
 * deterministic result.
 */
export function ownershipHistory(input: OwnershipHistoryInput): OwnershipHistoryEntry[] {
  const { channelId, relationships, entities, asOf } = input;
  const entityMap = new Map<string, Entity>(entities.map((e) => [e.id, e]));

  const ownershipEdges = relationships.filter((e) => endpointsOf(e) !== null);

  // Reachable-owner fixpoint: from the channel, pull in the owner endpoint of any
  // edge whose owned endpoint is already reachable, until the set stops growing.
  const reachable = new Set<string>([channelId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const edge of ownershipEdges) {
      const ends = endpointsOf(edge)!;
      if (reachable.has(ends.owned) && !reachable.has(ends.owner)) {
        reachable.add(ends.owner);
        grew = true;
      }
    }
  }

  const entries: OwnershipHistoryEntry[] = ownershipEdges
    .filter((edge) => reachable.has(endpointsOf(edge)!.owned))
    .map((edge) => {
      const ownerId = endpointsOf(edge)!.owner;
      const e = entityMap.get(ownerId);
      return {
        entityId: ownerId,
        name: e?.name,
        entityType: e?.type ?? null,
        relationship: edge.type,
        controlLevel: edge.control_level,
        ownershipPercentage: edge.ownership_percentage ?? null,
        effectiveFrom: edge.effective_from ?? null,
        effectiveTo: edge.effective_to ?? null,
        isCurrent: isTimeValid(edge, asOf) && edge.status !== "ENDED",
      };
    });

  entries.sort((a, b) => {
    const ta = toTime(a.effectiveFrom);
    const tb = toTime(b.effectiveFrom);
    if (ta !== tb) {
      if (ta === null) return 1; // undated sorts last
      if (tb === null) return -1;
      return tb - ta; // newest first
    }
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  return entries;
}
