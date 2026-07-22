import type { ExplanationCode, Relationship } from "@channelwatch/schemas";

/**
 * Ultimate-parent traversal (task-3 brief). From the direct owner, follow
 * entity→entity edges upward until no active parent remains, returning the full
 * chain (not just the top). Cycle-safe.
 */

interface ParentStep {
  edge: Relationship;
  parentId: string;
}

/**
 * Upward parent edges of a node among active edges:
 * - SUBSIDIARY_OF / PORTFOLIO_COMPANY_OF: the node is the subject (`from`); the
 *   parent is `to`.
 * - controlling OWNS / PARTIALLY_OWNS: the parent OWNS the node, so the node is
 *   the object (`to`) and the parent is `from`. Only CONTROLLING stakes count —
 *   a minority stake does not make an ultimate parent.
 */
function parentStepsOf(nodeId: string, activeEdges: Relationship[]): ParentStep[] {
  const steps: ParentStep[] = [];
  for (const edge of activeEdges) {
    if (
      (edge.type === "SUBSIDIARY_OF" || edge.type === "PORTFOLIO_COMPANY_OF") &&
      edge.from_entity_id === nodeId
    ) {
      steps.push({ edge, parentId: edge.to_entity_id });
    } else if (
      (edge.type === "OWNS" || edge.type === "PARTIALLY_OWNS") &&
      edge.control_level === "CONTROLLING" &&
      edge.to_entity_id === nodeId
    ) {
      steps.push({ edge, parentId: edge.from_entity_id });
    }
  }
  return steps;
}

export interface UltimateParentResult {
  /** Top of the chain; equals the direct owner when it has no active parent. */
  ultimateParentId: string;
  /** Load-bearing upward edges, direct-owner-first. Does not include the owning edge itself. */
  chain: Relationship[];
  cycleDetected: boolean;
  explanationCodes: ExplanationCode[];
}

/**
 * Walk upward from `directOwnerId`. At each node the single best parent edge is
 * followed (highest confidence, then lexical parent id for determinism). A
 * `visited` set makes the walk cycle-safe: on revisiting a node the chain-so-far
 * is returned with OWNERSHIP_CYCLE_DETECTED rather than looping forever.
 */
export function findUltimateParent(
  directOwnerId: string,
  activeEdges: Relationship[],
): UltimateParentResult {
  const chain: Relationship[] = [];
  const visited = new Set<string>([directOwnerId]);
  let current = directOwnerId;
  let cycleDetected = false;

  for (;;) {
    const steps = parentStepsOf(current, activeEdges);
    if (steps.length === 0) break;

    steps.sort((a, b) => {
      if (b.edge.confidence !== a.edge.confidence) return b.edge.confidence - a.edge.confidence;
      return a.parentId < b.parentId ? -1 : a.parentId > b.parentId ? 1 : 0;
    });
    const next = steps[0];
    if (!next) break;

    if (visited.has(next.parentId)) {
      chain.push(next.edge);
      cycleDetected = true;
      break;
    }

    chain.push(next.edge);
    visited.add(next.parentId);
    current = next.parentId;
  }

  return {
    ultimateParentId: current,
    chain,
    cycleDetected,
    explanationCodes: cycleDetected ? ["OWNERSHIP_CYCLE_DETECTED"] : [],
  };
}
