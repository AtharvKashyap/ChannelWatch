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
 * `INDEPENDENT` and `OWNERSHIP_CHANGED` exist for API/UI use but this
 * derivation NEVER emits them. Recent ownership change surfaces as the
 * OWNERSHIP_CHANGED_RECENTLY *warning*, not as a classification. The labels this
 * function can return are: PE_BACKED, CORPORATE_OWNED, NONPROFIT_OWNED,
 * EXTERNALLY_FUNDED, CREATOR_OWNED, DISPUTED, OWNERSHIP_UNCLEAR.
 */

const PE_ENTITY_TYPES: ReadonlySet<EntityType> = new Set(["PRIVATE_EQUITY_FIRM"]);
// Corporate/institutional owner types (ownership rules v2). Beyond the for-profit
// operating-company kinds, a documented majority owner that is an investment
// firm / VC firm / fund is a real, non-creator commercial owner → CORPORATE_OWNED
// (UNCLEAR is reserved for genuinely undocumented cases). PRIVATE_EQUITY_FIRM is
// deliberately excluded (it drives PE_BACKED); NONPROFIT gets its own label; and
// TRUST / UNKNOWN_ENTITY are left out because their nature is genuinely
// undetermined (they stay OWNERSHIP_UNCLEAR rather than being guessed corporate).
const CORPORATE_OWNER_TYPES: ReadonlySet<EntityType> = new Set([
  "COMPANY",
  "MEDIA_NETWORK",
  "SUBSIDIARY",
  "BRAND",
  "INVESTMENT_FIRM",
  "VENTURE_CAPITAL_FIRM",
  "FUND",
]);
const NONPROFIT_OWNER_TYPES: ReadonlySet<EntityType> = new Set(["NONPROFIT"]);
const CREATOR_OWNER_TYPES: ReadonlySet<EntityType> = new Set(["CREATOR", "PERSON"]);
const CHANNEL_OWNING_TYPES: ReadonlySet<string> = new Set(["OWNS", "ACQUIRED", "CONTROLS"]);
// Edge types by which a CREATOR/PERSON can control a company/nonprofit that owns
// the channel (creator-controlled-company rule). Each still requires a majority
// stake (CONTROLLING or >50%), except CONTROLS which is controlling by meaning.
const CREATOR_CONTROL_TYPES: ReadonlySet<string> = new Set(["CONTROLS", "OWNS", "PARTIALLY_OWNS"]);

export interface DeriveClassificationInput {
  channelId: string;
  relationships: Relationship[];
  entities: Entity[];
  /** Explicit evaluation date — determinism requires this be passed, never read from the clock. */
  asOf: Date;
  /** Optional last-reviewed timestamp used only for the RECORD_OUTDATED warning. */
  lastReviewedAt?: Date | string | null;
}

/**
 * One step of the ownership chain, channel-owner upward, enriched with the
 * mechanism of ownership and the resolved entity identity (ownership rules v2).
 * `entityId` is the higher (parent/owner) node the step connects to; `name` and
 * `entityType` are resolved from the `entities` input (null when not resolvable).
 */
export interface OwnershipChainStep {
  entityId: string;
  name?: string;
  entityType: EntityType | null;
  relationshipType: Relationship["type"];
  ownershipPercentage: number | null;
  controlLevel: Relationship["control_level"];
  effectiveFrom: string | null;
  confidence: number;
}

export interface ClassificationResult {
  classification: ClassificationLabel;
  /**
   * The highest-confidence single direct owner, or null when there is none or
   * the result is genuinely ambiguous. Kept for compatibility; for jointly
   * creator-owned channels this is one of the co-owners (see `directOwners`).
   */
  directOwner: EntityRef | null;
  /**
   * All direct owners. Usually a single-element list mirroring `directOwner`;
   * for jointly creator-owned channels it holds every tied co-owner. Empty when
   * there is no resolvable owner.
   */
  directOwners: EntityRef[];
  ultimateParent: EntityRef | null;
  /** Load-bearing edges from the channel to the ultimate parent (owning edge first). */
  chain: Relationship[];
  /**
   * The same load-bearing chain as `chain`, ordered channel-owner upward, with
   * each step carrying its ownership mechanism (relationship type, percentage,
   * control level, effective_from, confidence) and the resolved entity identity
   * (id, name, type). Empty when there is no resolvable owner. `chain` remains
   * the raw edge list for existing consumers; this is the display-oriented view.
   */
  ownershipChain: OwnershipChainStep[];
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
  const refsOf = (ids: string[]): EntityRef[] =>
    ids.map(refOf).filter((r): r is EntityRef => r !== null);

  // Enrich the load-bearing edge chain into display steps: the "up" node of each
  // edge (parent for SUBSIDIARY_OF/PORTFOLIO_COMPANY_OF, owner otherwise) with
  // its resolved identity and the ownership mechanism carried on the edge.
  const buildChain = (edges: Relationship[]): OwnershipChainStep[] =>
    edges.map((edge) => {
      const upId =
        edge.type === "SUBSIDIARY_OF" || edge.type === "PORTFOLIO_COMPANY_OF"
          ? edge.to_entity_id
          : edge.from_entity_id;
      const e = entityMap.get(upId);
      return {
        entityId: upId,
        name: e?.name,
        entityType: e?.type ?? null,
        relationshipType: edge.type,
        ownershipPercentage: edge.ownership_percentage ?? null,
        controlLevel: edge.control_level,
        effectiveFrom: edge.effective_from ?? null,
        confidence: edge.confidence,
      };
    });

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
      directOwners: direct.ownerId !== null ? refsOf([direct.ownerId]) : [],
      ultimateParent: refOf(ultimateParentId),
      chain,
      ownershipChain: buildChain(chain),
      confidence: minConfidence([...chain, ...disputedLoadBearing]),
      explanationCodes: ["OWNERSHIP_RELATIONSHIP_DISPUTED"],
      warnings: buildWarnings(chain, input.lastReviewedAt, asOf),
    };
  }

  // Ambiguous direct owner (tie among top candidates). Joint creator ownership
  // (the smosh case): when EVERY tied owner is a CREATOR/PERSON, the channel is
  // co-owned by creators — CREATOR_OWNED, not a guess. Any other tie (including
  // a mixed company/person tie) stays OWNERSHIP_UNCLEAR: precision over recall.
  if (direct.ambiguous) {
    const tiedOwnerIds = direct.tiedOwners.map((e) => e.from_entity_id);
    const allCreatorOwned =
      tiedOwnerIds.length > 0 &&
      tiedOwnerIds.every((id) => {
        const t = typeOf(id);
        return t !== null && CREATOR_OWNER_TYPES.has(t);
      });
    if (allCreatorOwned) {
      // `tiedOwners` is already sorted deterministically by owner id; the first
      // is the representative `directOwner` kept for compatibility.
      const representative = tiedOwnerIds[0]!;
      const jointChain = direct.tiedOwners;
      return {
        classification: "CREATOR_OWNED",
        directOwner: refOf(representative),
        directOwners: refsOf(tiedOwnerIds),
        // Co-ownership has no single ultimate parent; each creator is a leaf.
        ultimateParent: null,
        chain: jointChain,
        ownershipChain: buildChain(jointChain),
        confidence: minConfidence(jointChain),
        explanationCodes: ["JOINTLY_CREATOR_OWNED"],
        warnings: buildWarnings(jointChain, input.lastReviewedAt, asOf),
      };
    }
    return {
      classification: "OWNERSHIP_UNCLEAR",
      directOwner: null,
      directOwners: [],
      ultimateParent: null,
      chain: [],
      ownershipChain: [],
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
      directOwners: [],
      ultimateParent: null,
      chain: [],
      ownershipChain: [],
      confidence: 0,
      explanationCodes: ["NO_OWNERSHIP_EVIDENCE"],
      warnings: [],
    };
  }

  const ownerType = typeOf(direct.ownerId);
  const ultimateType = typeOf(ultimateParentId);
  // Base codes carry the direct-owner codes (DIRECT_OWNER_CONFIRMED, plus
  // MAJORITY_STAKE_OWNER when the owner was resolved from a majority stake) and
  // any cycle code from the upward walk.
  const baseCodes: ExplanationCode[] = [...direct.explanationCodes, ...cycleCodes];
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
    // PE precedence is deliberate: a majority-stake owner that is itself PE-backed
    // upward classifies PE_BACKED, not CORPORATE_OWNED (ownership rules v2).
    return finalize(
      "PE_BACKED",
      direct.ownerId,
      ultimateParentId,
      chain,
      loadBearing,
      [...baseCodes, "OWNER_IS_PE_PORTFOLIO_COMPANY"],
      warnings,
      refOf,
      buildChain,
    );
  }

  // ---- Creator-controlled company/nonprofit (ownership rules v2). A direct
  // owner that is a COMPANY / BRAND / NONPROFIT (etc.) but is itself controlled
  // by a CREATOR/PERSON is creator ownership through the company; the company is
  // kept as the named direct owner. Resolved before the corporate/nonprofit
  // rules because it overrides both. Emits CREATOR_CONTROLLED_COMPANY.
  const creatorControlledCompany = isCreatorControlledCompany(direct.ownerId, activeEdges, typeOf);
  if (creatorControlledCompany) {
    return finalize(
      "CREATOR_OWNED",
      direct.ownerId,
      ultimateParentId,
      chain,
      loadBearing,
      [...baseCodes, "CREATOR_CONTROLLED_COMPANY"],
      warnings,
      refOf,
      buildChain,
    );
  }

  // ---- Rule 3: CORPORATE_OWNED (corporate/institutional owner, no PE, not
  // creator-controlled).
  if (ownerType !== null && CORPORATE_OWNER_TYPES.has(ownerType)) {
    return finalize(
      "CORPORATE_OWNED",
      direct.ownerId,
      ultimateParentId,
      chain,
      loadBearing,
      baseCodes,
      warnings,
      refOf,
      buildChain,
    );
  }

  // ---- NONPROFIT_OWNED (ownership rules v2): a NONPROFIT direct owner that is
  // not creator-controlled gets its own honest label.
  if (ownerType !== null && NONPROFIT_OWNER_TYPES.has(ownerType)) {
    return finalize(
      "NONPROFIT_OWNED",
      direct.ownerId,
      ultimateParentId,
      chain,
      loadBearing,
      baseCodes,
      warnings,
      refOf,
      buildChain,
    );
  }

  // ---- Rule 4: EXTERNALLY_FUNDED (creator/person owner + active minority funding).
  // Only NON-controlling funding edges qualify (`control_level === "MINORITY"`),
  // so there is no overlap with the majority-stake owner rule (which requires
  // CONTROLLING or >50%): a controlling stake is never external funding.
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
        buildChain,
      );
    }
  }

  // ---- Rule 5: CREATOR_OWNED (creator/person direct owner). Creator-controlled
  // companies were already resolved above.
  if (ownerType !== null && CREATOR_OWNER_TYPES.has(ownerType)) {
    return finalize(
      "CREATOR_OWNED",
      direct.ownerId,
      ultimateParentId,
      chain,
      loadBearing,
      baseCodes,
      warnings,
      refOf,
      buildChain,
    );
  }

  // Owner found but not classifiable (e.g. TRUST / UNKNOWN_ENTITY owner whose
  // nature is genuinely undetermined). Precision over recall: OWNERSHIP_UNCLEAR.
  return finalize(
    "OWNERSHIP_UNCLEAR",
    direct.ownerId,
    ultimateParentId,
    chain,
    loadBearing,
    baseCodes,
    warnings,
    refOf,
    buildChain,
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
  buildChain: (edges: Relationship[]) => OwnershipChainStep[],
): ClassificationResult {
  const directOwner = refOf(ownerId);
  return {
    classification,
    directOwner,
    directOwners: directOwner ? [directOwner] : [],
    ultimateParent: refOf(ultimateParentId),
    chain,
    ownershipChain: buildChain(chain),
    confidence: minConfidence(loadBearing),
    explanationCodes: unique(explanationCodes),
    warnings,
  };
}

/**
 * Whether the direct owner (a company / brand / nonprofit) is itself controlled
 * by a CREATOR/PERSON — the creator-controlled-company rule (ownership rules v2).
 *
 * Two qualifying paths, both requiring a CREATOR/PERSON controller:
 *  (a) a direct control edge into the owner — CONTROLS, or OWNS/PARTIALLY_OWNS at
 *      a majority stake (CONTROLLING or >50%). This is the widened path (e.g.
 *      TLDR: the creator OWNS the company at a controlling stake).
 *  (b) the legacy path: the owner is FOUNDED_BY the creator who also holds a
 *      CONTROLLING PARTIALLY_OWNS stake in it. Kept as an additional path.
 *
 * A bare FOUNDED_BY with no controlling stake does NOT qualify (precision).
 */
function isCreatorControlledCompany(
  ownerId: string,
  activeEdges: Relationship[],
  typeOf: (id: string | null) => EntityType | null,
): boolean {
  const isCreator = (id: string): boolean => {
    const t = typeOf(id);
    return t !== null && CREATOR_OWNER_TYPES.has(t);
  };
  const isMajorityStake = (e: Relationship): boolean =>
    e.control_level === "CONTROLLING" ||
    (e.ownership_percentage != null && e.ownership_percentage > 50);

  // Path (a): a creator directly controls the owner.
  const directlyControlled = activeEdges.some((e) => {
    if (e.to_entity_id !== ownerId || !CREATOR_CONTROL_TYPES.has(e.type)) return false;
    if (!isCreator(e.from_entity_id)) return false;
    // CONTROLS is controlling by definition; OWNS/PARTIALLY_OWNS need a majority.
    return e.type === "CONTROLS" || isMajorityStake(e);
  });
  if (directlyControlled) return true;

  // Path (b): legacy FOUNDED_BY + controlling PARTIALLY_OWNS by the founder.
  const founderSet = new Set(
    activeEdges
      .filter((e) => e.type === "FOUNDED_BY" && e.from_entity_id === ownerId)
      .map((e) => e.to_entity_id)
      .filter(isCreator),
  );
  if (founderSet.size === 0) return false;
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
