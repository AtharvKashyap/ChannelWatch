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

/** Acknowledgement returned when a public correction is accepted into the queue. */
export const CORRECTION_RECEIVED = "Correction received and queued for review.";

/** Acknowledgement returned when a public research lead is accepted into the queue. */
export const RESEARCH_LEAD_RECEIVED = "Research lead received and queued for review.";

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

/**
 * Neutral summary shown for a channel that has not yet been researched. The
 * public read endpoints return this (with research_status UNRESEARCHED) rather
 * than a 404, so the extension can render a "not researched" state instead of an
 * error. Asserts nothing about ownership (§8: precision over recall).
 */
export const UNRESEARCHED_SUMMARY = "This channel has not yet been researched.";

/**
 * Input for `classificationSummary`. Names are the entity display names already
 * resolved by the caller; a null means "not available", never a guess.
 */
export interface ClassificationSummaryInput {
  label: ClassificationLabel;
  channelName: string;
  directOwnerName?: string | null;
  ultimateParentName?: string | null;
}

/**
 * The ONLY builder of the human-readable ownership summary sentence surfaced in
 * the lookup response (`classification.summary`). Composed from the §23.1
 * "safer language" primitives above — every branch describes ownership
 * structure as public fact and never asserts editorial control or loss of
 * control. Routes MUST call this; they may never inline summary prose.
 */
export function classificationSummary(input: ClassificationSummaryInput): string {
  // Some canonical entity names legitimately end in a period (e.g. "Blackstone
  // Inc."). The copy primitives append their own sentence-final period, so trim
  // a single trailing period from interpolated names to avoid "Inc..".
  const trimDot = (name: string): string => name.replace(/\.\s*$/, "");
  const channelName = trimDot(input.channelName);
  const label = input.label;
  const owner = input.directOwnerName != null ? trimDot(input.directOwnerName) : null;
  const parent = input.ultimateParentName != null ? trimDot(input.ultimateParentName) : null;
  const hasDistinctParent = parent !== null && parent !== owner;

  switch (label) {
    case "PE_BACKED":
      if (owner !== null && hasDistinctParent) {
        return `${ownedBy(channelName, owner)} ${portfolioCompanyOf(owner, parent)}`;
      }
      if (owner !== null) return ownedBy(channelName, owner);
      return `Public records indicate that ${channelName} is backed by private-equity investment.`;
    case "CORPORATE_OWNED":
      if (owner !== null && hasDistinctParent) {
        return `${ownedBy(channelName, owner)} ${owner} is a subsidiary of ${parent}.`;
      }
      if (owner !== null) return ownedBy(channelName, owner);
      return `Public records indicate that ${channelName} is owned by a corporate parent.`;
    case "CREATOR_OWNED":
      if (owner !== null) return ownedBy(channelName, owner);
      return `Public records indicate that ${channelName} is owned by its creator.`;
    case "EXTERNALLY_FUNDED":
      if (owner !== null) {
        return `${ownedBy(channelName, owner)} External investors hold a minority stake.`;
      }
      return `Public records indicate that ${channelName} has external minority investors.`;
    case "OWNERSHIP_CHANGED":
      return `Public records indicate that the ownership of ${channelName} has recently changed.`;
    case "INDEPENDENT":
      return `Public records do not indicate external ownership of ${channelName}.`;
    case "DISPUTED":
      return `Public ownership information for ${channelName} is currently disputed.`;
    case "OWNERSHIP_UNCLEAR":
    default:
      return `Public sources do not clearly establish who owns ${channelName}.`;
  }
}
