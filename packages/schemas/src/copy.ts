import type { ClassificationLabel } from "./enums.js";

/**
 * The ONLY place user-facing ownership copy lives.
 *
 * All strings follow SPEC §23.1 "Safer Language": describe ownership structure
 * as public fact, never assert editorial control or use loaded phrasing. No
 * export here may produce "sold out" or claim the creator lost control.
 */

/** Badge display text per classification label (SPEC §9.1). */
export const BADGE_LABELS: Record<ClassificationLabel, string> = {
  INDEPENDENT: "Independent",
  CREATOR_OWNED: "Creator-Owned",
  EXTERNALLY_FUNDED: "Externally Funded",
  CORPORATE_OWNED: "Corporate-Owned",
  PE_BACKED: "PE-Backed",
  OWNERSHIP_CHANGED: "Ownership Changed",
  OWNERSHIP_UNCLEAR: "Ownership Unclear",
  DISPUTED: "Disputed",
};

/**
 * The standing disclaimer shown alongside every classification. Kept verbatim:
 * classifications describe ownership structure only, never editorial conduct.
 */
export const EDITORIAL_DISCLAIMER = "No conclusion is made about editorial interference.";

/** Call-to-action for the correction workflow (SPEC §23.3). */
export const CORRECTION_CTA = "Report an Error";

/**
 * Neutral, fact-first ownership statement (§23.1 preferred phrasing):
 * "Public records indicate that {owner} owns {channel}."
 */
export function ownedBy(channel: string, owner: string): string {
  return `Public records indicate that ${owner} owns ${channel}.`;
}

/**
 * Describes a portfolio relationship without implying misconduct or control:
 * "{owner} is a portfolio company of {sponsor}."
 */
export function portfolioCompanyOf(owner: string, sponsor: string): string {
  return `${owner} is a portfolio company of ${sponsor}.`;
}

/**
 * States that a stake exists but its size is not public — avoids asserting the
 * creator lost control (§23.1 preferred phrasing).
 */
export function undisclosedStake(creator: string): string {
  return `${creator} retains a stake, but the exact ownership percentage was not publicly disclosed.`;
}
