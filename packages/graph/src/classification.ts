import type {
  ClassificationLabel,
  Entity,
  EntityRef,
  EntityType,
  ExplanationCode,
  Relationship,
} from "@channelwatch/schemas";
import { buildOwnershipGraph, isTimeValid } from "./graph.js";
import { findDirectOwner } from "./direct-owner.js";
import { findUltimateParent } from "./ultimate-parent.js";

/**
 * Ownership classification (task-3 brief). Classification is COMPUTED from
 * active relationships by graph traversal — never asserted — and every
 * non-obvious outcome carries machine-readable explanation codes so the label is
 * always auditable (§26.2). Precision over recall: when the rules do not clearly
 * match, the answer is OWNERSHIP_UNCLEAR, never a guess.
 *
 * NOTE on the classification label set (schemas `CLASSIFICATION_LABELS`):
 * `INDEPENDENT` and `OWNERSHIP_CHANGED` exist for API/UI use but this M1
 * derivation NEVER emits them. Recent ownership change surfaces as the
 * OWNERSHIP_CHANGED_RECENTLY *warning*, not as a classification. The labels this
 * function can return are: PE_BACKED, CORPORATE_OWNED, EXTERNALLY_FUNDED,
 * CREATOR_OWNED, DISPUTED, OWNERSHIP_UNCLEAR.
 */

const PE_ENTITY_TYPES: ReadonlySet<EntityType> = new Set(["PRIVATE_EQUITY_FIRM"]);
const CORPORATE_OWNER_TYPES: ReadonlySet<EntityType> = new Set([
  "COMPANY",
  "MEDIA_NETWORK",
  "SUBSIDIARY",
  "BRAND",
]);
const CREATOR_OWNER_TYPES: ReadonlySet<EntityType> = new Set(["CREATOR", "PERSON"]);
const CHANNEL_OWNING_TYPES: ReadonlySet<string> = new Set(["OWNS", "ACQUIRED", "CONTROLS"]);

export interface DeriveClassificationInput {
  channelId: string;
  relationships: Relationship[];
  entities: Entity[];
  /** Explicit evaluation date — determinism requires this be passed, never read from the clock. */
  asOf: Date;
  /** Optional last-reviewed timestamp used only for the RECORD_OUTDATED warning. */
  lastReviewedAt?: Date | string | null;
}

export interface ClassificationResult {
  classification: ClassificationLabel;
  directOwner: EntityRef | null;
  ultimateParent: EntityRef | null;
  /** Load-bearing edges from the channel to the ultimate parent (owning edge first). */
  chain: Relationship[];
  /** min(confidence) over the load-bearing edges; 0 when there are none. */
  confidence: number;
  explanationCodes: ExplanationCode[];
  warnings: ExplanationCode[];
}

function twelveMonthsBefore(asOf: Date): Date {
  const d = new Date(asOf);
  d.setUTCMonth(d.getUTCMonth() - 12);
  return d;
}

function toTime(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function minConfidence(edges: Relationship[]): number {
  if (edges.length === 0) return 0;
  return edges.reduce((acc, e) => Math.min(acc, e.confidence), Number.POSITIVE_INFINITY);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function deriveClassification(input: DeriveClassificationInput): ClassificationResult {
  const { channelId, relationships, entities, asOf } = input;
  const entityMap = new Map<string, Entity>(entities.map((e) => [e.id, e]));
  const typeOf = (id: string | null): EntityType | null => entityMap.get(id ?? "")?.type ?? null;
  const refOf = (id: string | null): EntityRef | null => {
    if (id === null) return null;
    const e = entityMap.get(id);
    return e ? { id: e.id, name: e.name, type: e.type } : null;
  };

  const { activeEdges } = buildOwnershipGraph(relationships, asOf);
  const direct = findDirectOwner(channelId, activeEdges);

  // Active owner chain (empty when there is no active owner).
  let ultimateParentId: string | null = null;
  let upwardChain: Relationship[] = [];
  let cycleCodes: ExplanationCode[] = [];
  if (direct.ownerId !== null && direct.edge !== null) {
    const up = findUltimateParent(direct.ownerId, activeEdges);
    ultimateParentId = up.ultimateParentId;
    upwardChain = up.chain;
    cycleCodes = up.explanationCodes;
  }
  const chain: Relationship[] = direct.edge ? [direct.edge, ...upwardChain] : [];
  const chainNodeIds = new Set<string>([
    channelId,
    ...(direct.ownerId ? [direct.ownerId] : []),
    ...upwardChain.map((e) => e.to_entity_id),
    ...upwardChain.map((e) => e.from_entity_id),
  ]);

  // ---- Rule 1: DISPUTED (highest precedence). A time-valid, DISPUTED-status
  // load-bearing edge poisons the whole classification. Checked against
  // time-valid edges (not just ACTIVE ones) because a DISPUTED edge is by
  // definition not ACTIVE yet is still load-bearing for this rule.
  const disputedLoadBearing = relationships.filter((r) => {
    if (r.status !== "DISPUTED" || !isTimeValid(r, asOf)) return false;
    const ownsChannel = r.to_entity_id === channelId && CHANNEL_OWNING_TYPES.has(r.type);
    const upwardSubsidiary =
      (r.type === "SUBSIDIARY_OF" || r.type === "PORTFOLIO_COMPANY_OF") &&
      chainNodeIds.has(r.from_entity_id);
    const upwardControlling =
      (r.type === "OWNS" || r.type === "PARTIALLY_OWNS") &&
      r.control_level === "CONTROLLING" &&
      chainNodeIds.has(r.to_entity_id);
    return ownsChannel || upwardSubsidiary || upwardControlling;
  });
  if (disputedLoadBearing.length > 0) {
    return {
      classification: "DISPUTED",
      directOwner: refOf(direct.ownerId),
      ultimateParent: refOf(ultimateParentId),
      chain,
      confidence: minConfidence([...chain, ...disputedLoadBearing]),
      explanationCodes: ["OWNERSHIP_RELATIONSHIP_DISPUTED"],
      warnings: buildWarnings(chain, input.lastReviewedAt, asOf),
    };
  }

  // Ambiguous direct owner (tie) → precision over recall.
  if (direct.ambiguous) {
    return {
      classification: "OWNERSHIP_UNCLEAR",
      directOwner: null,
      ultimateParent: null,
      chain: [],
      confidence: 0,
      explanationCodes: ["MULTIPLE_OWNER_CANDIDATES"],
      warnings: [],
    };
  }

  // Rule 6: no active ownership edges → OWNERSHIP_UNCLEAR.
  if (direct.ownerId === null) {
    return {
      classification: "OWNERSHIP_UNCLEAR",
      directOwner: null,
      ultimateParent: null,
      chain: [],
      confidence: 0,
      explanationCodes: ["NO_OWNERSHIP_EVIDENCE"],
      warnings: [],
    };
  }

  const ownerType = typeOf(direct.ownerId);
  const ultimateType = typeOf(ultimateParentId);
  const baseCodes: ExplanationCode[] = ["DIRECT_OWNER_CONFIRMED", ...cycleCodes];
  const warnings = buildWarnings(chain, input.lastReviewedAt, asOf);
  const loadBearing = [...chain];

  // ---- Rule 2: PE_BACKED.
  const portfolioOfPe = chain.some(
    (e) =>
      e.type === "PORTFOLIO_COMPANY_OF" &&
      PE_ENTITY_TYPES.has(typeOf(e.to_entity_id) ?? ("" as EntityType)),
  );
  const peInChain =
    (ownerType !== null && PE_ENTITY_TYPES.has(ownerType)) ||
    (ultimateType !== null && PE_ENTITY_TYPES.has(ultimateType)) ||
    portfolioOfPe;
  if (peInChain) {
    return finalize(
      "PE_BACKED",
      direct.ownerId,
      ultimateParentId,
      chain,
      loadBearing,
      [...baseCodes, "OWNER_IS_PE_PORTFOLIO_COMPANY"],
      warnings,
      refOf,
    );
  }

  // ---- Rule 5 (case B) short-circuit: a creator-controlled company is
  // CREATOR_OWNED even though its entity type is COMPANY. The two rules overlap
  // on this structure; the brief's named "creator LLC" test adjudicates the
  // outcome as CREATOR_OWNED, so it is resolved before the corporate rule.
  const creatorControlledCompany = isCreatorControlledCompany(direct.ownerId, activeEdges, typeOf);

  // ---- Rule 3: CORPORATE_OWNED (no PE, not a creator-controlled company).
  if (ownerType !== null && CORPORATE_OWNER_TYPES.has(ownerType) && !creatorControlledCompany) {
    return finalize(
      "CORPORATE_OWNED",
      direct.ownerId,
      ultimateParentId,
      chain,
      loadBearing,
      baseCodes,
      warnings,
      refOf,
    );
  }

  // ---- Rule 4: EXTERNALLY_FUNDED (creator/person owner + active minority funding).
  if (ownerType !== null && CREATOR_OWNER_TYPES.has(ownerType)) {
    const fundingEdge = activeEdges.find(
      (e) =>
        (e.type === "FUNDS" || e.type === "INVESTED_IN") &&
        e.control_level === "MINORITY" &&
        (e.to_entity_id === channelId || e.to_entity_id === direct.ownerId),
    );
    if (fundingEdge) {
      return finalize(
        "EXTERNALLY_FUNDED",
        direct.ownerId,
        ultimateParentId,
        chain,
        [...loadBearing, fundingEdge],
        baseCodes,
        warnings,
        refOf,
      );
    }
  }

  // ---- Rule 5: CREATOR_OWNED (creator/person owner, or creator-controlled company).
  if ((ownerType !== null && CREATOR_OWNER_TYPES.has(ownerType)) || creatorControlledCompany) {
    return finalize(
      "CREATOR_OWNED",
      direct.ownerId,
      ultimateParentId,
      chain,
      loadBearing,
      baseCodes,
      warnings,
      refOf,
    );
  }

  // Owner found but not classifiable under the M1 rules (e.g. FUND / TRUST /
  // investment firm owner). Precision over recall: OWNERSHIP_UNCLEAR.
  return finalize(
    "OWNERSHIP_UNCLEAR",
    direct.ownerId,
    ultimateParentId,
    chain,
    loadBearing,
    baseCodes,
    warnings,
    refOf,
  );
}

function finalize(
  classification: ClassificationLabel,
  ownerId: string | null,
  ultimateParentId: string | null,
  chain: Relationship[],
  loadBearing: Relationship[],
  explanationCodes: ExplanationCode[],
  warnings: ExplanationCode[],
  refOf: (id: string | null) => EntityRef | null,
): ClassificationResult {
  return {
    classification,
    directOwner: refOf(ownerId),
    ultimateParent: refOf(ultimateParentId),
    chain,
    confidence: minConfidence(loadBearing),
    explanationCodes: unique(explanationCodes),
    warnings,
  };
}

/**
 * True when the owner is a company FOUNDED_BY a creator/person who also holds a
 * CONTROLLING PARTIALLY_OWNS stake in that company (brief rule 5 case B).
 */
function isCreatorControlledCompany(
  ownerId: string,
  activeEdges: Relationship[],
  typeOf: (id: string | null) => EntityType | null,
): boolean {
  const founders = activeEdges
    .filter((e) => e.type === "FOUNDED_BY" && e.from_entity_id === ownerId)
    .map((e) => e.to_entity_id)
    .filter((founderId) => {
      const t = typeOf(founderId);
      return t !== null && CREATOR_OWNER_TYPES.has(t);
    });
  if (founders.length === 0) return false;
  const founderSet = new Set(founders);
  return activeEdges.some(
    (e) =>
      e.type === "PARTIALLY_OWNS" &&
      e.control_level === "CONTROLLING" &&
      e.to_entity_id === ownerId &&
      founderSet.has(e.from_entity_id),
  );
}

/**
 * Warnings (not classifications):
 * - OWNERSHIP_CHANGED_RECENTLY: any owner-chain edge whose `effective_from` is
 *   strictly newer than 12 months before `asOf` (§9.4). An edge exactly 12
 *   months old is at the boundary and is NOT flagged.
 * - RECORD_OUTDATED: a provided `lastReviewedAt` strictly older than 12 months.
 */
function buildWarnings(
  chain: Relationship[],
  lastReviewedAt: Date | string | null | undefined,
  asOf: Date,
): ExplanationCode[] {
  const warnings: ExplanationCode[] = [];
  const cutoff = twelveMonthsBefore(asOf).getTime();

  const recentChange = chain.some((e) => {
    const t = toTime(e.effective_from);
    return t !== null && t > cutoff;
  });
  if (recentChange) warnings.push("OWNERSHIP_CHANGED_RECENTLY");

  if (lastReviewedAt !== null && lastReviewedAt !== undefined) {
    const reviewed =
      lastReviewedAt instanceof Date ? lastReviewedAt.getTime() : toTime(lastReviewedAt);
    if (reviewed !== null && reviewed < cutoff) warnings.push("RECORD_OUTDATED");
  }

  return warnings;
}
