import type {
  ClassificationLabel,
  ConfidenceLabel,
  CreatorStatus,
  ExplanationCode,
} from "./enums.js";

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

/**
 * Human-readable confidence label shown in the ownership panel. Mirrors the
 * §14.3 bands (`confidenceLabelFromScore`) — display text only, never a new
 * threshold. DISPUTED/UNKNOWN are conflict/absence states, not score bands.
 */
export const CONFIDENCE_LABEL_TEXT: Record<ConfidenceLabel, string> = {
  CONFIRMED: "Confirmed",
  HIGH: "High confidence",
  MODERATE: "Moderate confidence",
  LOW: "Low confidence",
  DISPUTED: "Disputed",
  UNKNOWN: "Unknown",
};

/**
 * Neutral, auditable text for each §26.2 explanation code. The panel surfaces
 * the `warnings` array (a subset of these codes — the §9.4 warning codes) so a
 * reader can see WHY a label was applied. Every branch describes ownership
 * structure as public fact; none asserts editorial control or loss of control
 * (§23.1).
 */
export const EXPLANATION_TEXT: Record<ExplanationCode, string> = {
  DIRECT_OWNER_CONFIRMED: "The direct owner is confirmed by public sources.",
  OWNER_IS_PE_PORTFOLIO_COMPANY: "The owner is a private-equity portfolio company.",
  MULTIPLE_OWNER_CANDIDATES: "Public sources point to more than one possible owner.",
  JOINTLY_CREATOR_OWNED: "Public records indicate joint ownership with the creator.",
  OWNERSHIP_CYCLE_DETECTED: "The ownership records reference each other in a loop.",
  OWNERSHIP_RELATIONSHIP_DISPUTED: "The ownership relationship is currently disputed.",
  NO_OWNERSHIP_EVIDENCE: "No public ownership evidence was found.",
  OWNERSHIP_CHANGED_RECENTLY: "Public records indicate the ownership changed recently.",
  RECORD_OUTDATED: "This record may be out of date and is due for re-review.",
};

/**
 * Neutral display text for each §6.5 creator-involvement state. Describes the
 * creator's structural relationship to the channel as public fact — never
 * asserts the creator "sold out" or lost editorial control (§23.1).
 */
export const CREATOR_STATUS_TEXT: Record<CreatorStatus, string> = {
  OWNER_OPERATOR: "Creator owns and operates the channel",
  OWNER_EXTERNAL_MGMT: "Creator owns the channel; operations are externally managed",
  MAJORITY_OWNER: "Creator holds a majority stake",
  MINORITY_OWNER: "Creator holds a minority stake",
  HOST_NOT_IN_CONTROL: "Creator hosts the channel without an ownership stake",
  REMAINS_HOST: "Creator remains the on-screen host",
  EXITED: "Creator is no longer involved",
  UNCLEAR: "Creator involvement is unclear",
  CORPORATE_BRAND: "This is a corporate brand channel",
};

/**
 * Static UI strings for the ownership panel and its in-panel correction form
 * (§18.3 panel, §23.3 "Report an Error"). Section labels and form labels live
 * here rather than inline in the component so ALL user-facing copy stays in the
 * single reviewed module (CLAUDE.md rule 2).
 */
export const PANEL_COPY = {
  panelTitle: "Ownership",
  close: "Close",
  directOwnerLabel: "Direct owner",
  ultimateParentLabel: "Ultimate parent",
  creatorStatusLabel: "Creator status",
  confidenceLabel: "Confidence",
  evidenceLabel: "Evidence",
  lastReviewedLabel: "Last reviewed",
  warningsLabel: "Notes",
  neverReviewed: "Not yet reviewed",
  unresearchedHeading: "Not yet researched",
  correctionHeading: "Report an Error",
  explanationLabel: "What is incorrect? (required)",
  explanationPlaceholder: "Describe what is inaccurate and, if possible, link to a public source.",
  nameLabel: "Your name (optional)",
  emailLabel: "Your email (optional)",
  relationshipLabel: "Your relationship to the channel (optional)",
  submit: "Submit correction",
  submitting: "Submitting…",
  explanationTooShort: "Please provide at least 20 characters so a reviewer can act on it.",
  submitError: "Could not submit the correction. Please try again later.",
} as const;

/**
 * Accessible label for the badge control. Built here (not inline in the
 * renderer) so ALL user-facing copy stays in the reviewed module (CLAUDE.md
 * rule 2). Embeds the reviewed `BADGE_LABELS` text.
 */
export function badgeAriaLabel(label: ClassificationLabel): string {
  return `Ownership: ${BADGE_LABELS[label]}. Open details.`;
}

/**
 * Static strings for the toolbar popup (SPEC §18.1). The popup shows no
 * ownership data; these are chrome/status strings, kept in the reviewed module
 * so no user-facing copy is inlined in the component.
 */
export const POPUP_COPY = {
  title: "CHANNELWATCH",
  description:
    "Ownership badges appear next to channel names on watch and channel pages. Click a badge to see who owns the channel and the sources behind it.",
  openSettings: "Open settings",
} as const;

/** "N sources reviewed", pluralized; "No sources reviewed" for zero. */
export function evidenceCountText(count: number): string {
  if (count <= 0) return "No sources reviewed";
  if (count === 1) return "1 source reviewed";
  return `${count} sources reviewed`;
}

/** "Last reviewed {date}", or the neutral "not reviewed" line when null. */
export function lastReviewedText(isoDate: string | null): string {
  if (isoDate == null || isoDate === "") return PANEL_COPY.neverReviewed;
  return `Last reviewed ${isoDate}`;
}
