/**
 * Two-person review policy (SPEC §20.3), as a set of PURE functions so the rule
 * is unit-testable in isolation from the DB and HTTP layers.
 *
 * §20.3 requires a SECOND, distinct reviewer before publishing a "high-risk"
 * claim (hidden ownership, undisclosed acquisition, fraud, misrepresentation,
 * editorial interference, political influence, or named individuals). In the MVP
 * data model the reviewer console does not carry a free "risk" flag, so
 * sensitivity is DERIVED from the claim's own structure (the Track-B brief:
 * "a PE-related or disputed claim needs a SECOND distinct reviewer"):
 *
 *   - PE-RELATED — the predicate is PORTFOLIO_COMPANY_OF, or a participating
 *     entity is a private-equity / investment / venture / fund entity. Private
 *     equity is the highest-scrutiny ownership structure (§9, §20.2 "confirm
 *     whether private equity involvement is direct or indirect").
 *   - DISPUTED — the claim (or a relationship it concerns) is contested.
 *   - NAMED INDIVIDUAL — a participating entity is a natural PERSON (§20.3
 *     "named individuals").
 *
 * "Sensitive" is a PROCESS flag — it means "needs a second look", never an
 * accusation of wrongdoing (CLAUDE.md, §23.1).
 */

/** Entity types that make a claim PE-related for two-person purposes. */
const PE_ENTITY_TYPES: ReadonlySet<string> = new Set([
  "PRIVATE_EQUITY_FIRM",
  "INVESTMENT_FIRM",
  "VENTURE_CAPITAL_FIRM",
  "FUND",
]);

/** Predicates that inherently concern a private-equity ownership structure. */
const PE_PREDICATES: ReadonlySet<string> = new Set(["PORTFOLIO_COMPANY_OF"]);

export interface ClaimSensitivityInput {
  /** The claim predicate (free TEXT; e.g. "OWNED_BY", "PORTFOLIO_COMPANY_OF"). */
  predicate: string;
  /** The claim's review-workflow status, if set. */
  claimStatus: string | null | undefined;
  /** Entity types of the participating subject/object entities (any order). */
  involvedEntityTypes: readonly (string | null | undefined)[];
}

/** True when a claim is PE-related (predicate or a participating PE-type entity). */
export function isPeRelated(input: ClaimSensitivityInput): boolean {
  if (PE_PREDICATES.has(input.predicate)) return true;
  return input.involvedEntityTypes.some((t) => t != null && PE_ENTITY_TYPES.has(t));
}

/** True when a claim participates a natural PERSON (a named individual, §20.3). */
export function involvesNamedIndividual(input: ClaimSensitivityInput): boolean {
  return input.involvedEntityTypes.some((t) => t === "PERSON");
}

/** True when the claim is contested. */
export function isDisputed(input: ClaimSensitivityInput): boolean {
  return input.claimStatus === "DISPUTED";
}

/**
 * A claim is SENSITIVE — requiring two-person review before publication — when it
 * is PE-related, disputed, or involves a named individual (§20.3).
 */
export function isSensitiveClaim(input: ClaimSensitivityInput): boolean {
  return isPeRelated(input) || isDisputed(input) || involvesNamedIndividual(input);
}

/** Minimum distinct approving reviewers before a claim may be published. */
export function requiredApprovals(sensitive: boolean): number {
  return sensitive ? 2 : 1;
}

/**
 * Whether a claim may be published given the set of DISTINCT reviewer ids that
 * have approved it. Non-sensitive claims need one approval; sensitive claims
 * need two DISTINCT reviewers (§20.3) — the same reviewer approving twice does
 * not satisfy the rule, which is why the caller passes a de-duplicated set.
 */
export function canPublish(sensitive: boolean, distinctApproverCount: number): boolean {
  return distinctApproverCount >= requiredApprovals(sensitive);
}
