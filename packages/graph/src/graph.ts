import type { Relationship } from "@channelwatch/schemas";

/**
 * Ownership-graph primitives (task-3 brief). Pure functions only — no I/O, no
 * clock. Time-dependence is always expressed through an explicit `asOf: Date`
 * parameter so the same inputs always produce the same output (determinism is a
 * founding requirement; never call Date.now() in this library).
 */

/** The active-edge view of a set of relationships, indexed by endpoint. */
export interface OwnershipGraph {
  /** Edges that are ACTIVE as of `asOf` (status + time window). */
  activeEdges: Relationship[];
  /** Active edges grouped by `from_entity_id`. */
  edgesByFrom: Map<string, Relationship[]>;
  /** Active edges grouped by `to_entity_id`. */
  edgesByTo: Map<string, Relationship[]>;
}

function parseDate(value: string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * A relationship's time window is current as of `asOf` when it has already come
 * into force (`effective_from` is null or not after `asOf`) and has not ended
 * (`effective_to` is null or strictly after `asOf`). A past `effective_to`
 * means the edge was superseded and must be ignored (brief: "expired ownership
 * ignored"). An unparseable date is treated as unbounded on that side.
 */
export function isTimeValid(rel: Relationship, asOf: Date): boolean {
  const from = parseDate(rel.effective_from);
  const to = parseDate(rel.effective_to);
  if (from !== null && from.getTime() > asOf.getTime()) return false;
  if (to !== null && to.getTime() <= asOf.getTime()) return false;
  return true;
}

/**
 * An edge is ACTIVE iff its lifecycle status is exactly ACTIVE and its time
 * window is current. DISPUTED / ENDED / PENDING_REVIEW edges are never active;
 * DISPUTED edges are handled separately by the classifier (they drive a
 * DISPUTED outcome rather than silently contributing to a chain).
 */
export function isActive(rel: Relationship, asOf: Date): boolean {
  return rel.status === "ACTIVE" && isTimeValid(rel, asOf);
}

function pushInto(map: Map<string, Relationship[]>, key: string, value: Relationship): void {
  const bucket = map.get(key);
  if (bucket) bucket.push(value);
  else map.set(key, [value]);
}

/** Build the active-edge adjacency view used by owner/parent traversal. */
export function buildOwnershipGraph(relationships: Relationship[], asOf: Date): OwnershipGraph {
  const activeEdges = relationships.filter((r) => isActive(r, asOf));
  const edgesByFrom = new Map<string, Relationship[]>();
  const edgesByTo = new Map<string, Relationship[]>();
  for (const edge of activeEdges) {
    pushInto(edgesByFrom, edge.from_entity_id, edge);
    pushInto(edgesByTo, edge.to_entity_id, edge);
  }
  return { activeEdges, edgesByFrom, edgesByTo };
}
