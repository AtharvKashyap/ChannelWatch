import type {
  ClassificationLabel,
  ConfidenceLabel,
  ControlLevel,
  CreatorStatus,
  ExplanationCode,
  RelationshipType,
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
  NONPROFIT_OWNED: "Nonprofit-Owned",
  PE_BACKED: "PE-Backed",
  OWNERSHIP_CHANGED: "Ownership Changed",
  OWNERSHIP_UNCLEAR: "Ownership Unclear",
  DISPUTED: "Disputed",
};

/**
 * Short, plain-language verdict SENTENCE per classification label — the one-line
 * "printed record" headline shown under the channel name in the M3 popup
 * (distinct from the fuller `classification.summary`, which is rendered beneath
 * it). Every branch is a neutral, structural statement of ownership form as
 * public fact (§23.1 safer language): it names the STRUCTURE, never editorial
 * control or misconduct. PE_BACKED reads as private-equity FINANCING, never as a
 * red/"disputed" verdict — RED/DISPUTED is its own branch.
 */
export const VERDICT_SENTENCE: Record<ClassificationLabel, string> = {
  INDEPENDENT: "Independently owned.",
  CREATOR_OWNED: "Owned by its creator.",
  EXTERNALLY_FUNDED: "Externally funded.",
  CORPORATE_OWNED: "Corporately owned.",
  NONPROFIT_OWNED: "Owned by a nonprofit organization.",
  PE_BACKED: "Financed by private equity.",
  OWNERSHIP_CHANGED: "Ownership recently changed.",
  OWNERSHIP_UNCLEAR: "Ownership is unclear.",
  DISPUTED: "Ownership is disputed.",
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
 * Maximum length of an entity name rendered INSIDE a badge before it is
 * truncated with an ellipsis (§9.1: the badge is a compact chip, not a label
 * for a full legal name). The full, untruncated name is always shown in the
 * ownership panel — truncation is a display concern of the badge only.
 */
export const BADGE_NAME_MAX_LENGTH = 24;

/** Truncate a display name to `max` chars, replacing the overflow with "…". */
export function truncateName(name: string, max: number = BADGE_NAME_MAX_LENGTH): string {
  const trimmed = name.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Classification labels whose badge appends the operative entity name (the
 * adjudicated naming rule): PE_BACKED names the ultimate PE firm; CORPORATE_/
 * NONPROFIT_OWNED name the direct owner. CREATOR_OWNED and every other label
 * carry no name suffix.
 */
const NAME_SUFFIXED_LABELS: ReadonlySet<ClassificationLabel> = new Set([
  "PE_BACKED",
  "CORPORATE_OWNED",
  "NONPROFIT_OWNED",
]);

/**
 * Badge display text: the reviewed `BADGE_LABELS[label]`, optionally followed by
 * the operative entity name for the name-suffixed labels (PE_BACKED,
 * CORPORATE_OWNED, NONPROFIT_OWNED) as `${label} · ${name}`. The name is
 * truncated to `BADGE_NAME_MAX_LENGTH` for the chip; the panel shows it in full.
 * When no name applies (creator-owned, unclear, disputed, or no name resolved)
 * this is exactly `BADGE_LABELS[label]`.
 */
export function badgeText(label: ClassificationLabel, name?: string | null): string {
  const base = BADGE_LABELS[label];
  if (name != null && name.trim() !== "" && NAME_SUFFIXED_LABELS.has(label)) {
    return `${base} · ${truncateName(name)}`;
  }
  return base;
}

/**
 * Neutral, data-driven mechanism phrase for one ownership-chain hop (§23.1
 * safer language). Describes HOW the higher entity relates to the lower one,
 * using only structural terms sourced from the relationship data — never loaded
 * phrasing. `controlLevel` refines the stake edges (a controlling OWNS reads as
 * a "controlling stake"; a majority PARTIALLY_OWNS/INVESTED_IN as a "majority
 * investment"; otherwise a neutral "minority investment").
 */
export function ownershipMechanismText(
  relationship: RelationshipType,
  controlLevel: ControlLevel,
): string {
  switch (relationship) {
    case "ACQUIRED":
      return "acquired";
    case "SUBSIDIARY_OF":
      return "subsidiary of";
    case "PORTFOLIO_COMPANY_OF":
      return "portfolio company of";
    case "CONTROLS":
      return "controlling stake";
    case "OWNS":
      return controlLevel === "CONTROLLING" ? "controlling stake" : "ownership stake";
    case "PARTIALLY_OWNS":
    case "INVESTED_IN":
      return controlLevel === "CONTROLLING" ? "majority investment" : "minority investment";
    case "FUNDS":
      return "minority investment";
    default:
      return "ownership stake";
  }
}

/**
 * Neutral text for an ownership stake size (§23.1): the exact percentage when
 * publicly sourced (`ownership_percentage` non-null), otherwise the honest
 * "stake not publicly disclosed" — never an assertion that the stake is
 * controlling or that the creator lost control.
 */
export function ownershipStakeText(ownershipPercentage: number | null): string {
  if (ownershipPercentage == null) return "stake not publicly disclosed";
  return `${ownershipPercentage}% stake`;
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
    case "NONPROFIT_OWNED":
      if (owner !== null) {
        return `Public records indicate that ${owner}, a nonprofit organization, owns ${channelName}.`;
      }
      return `Public records indicate that ${channelName} is owned by a nonprofit organization.`;
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
  MAJORITY_STAKE_OWNER: "The owner is documented as holding a majority stake.",
  CREATOR_CONTROLLED_COMPANY: "The owning company is controlled by its creator.",
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
 * rule 2). Embeds the reviewed `badgeText` — so a name-suffixed badge announces
 * the operative entity name too (PE-Backed · Blackstone). The name, when given,
 * is announced IN FULL (screen readers are not space-constrained like the chip).
 */
export function badgeAriaLabel(label: ClassificationLabel, name?: string | null): string {
  const named =
    name != null && name.trim() !== "" && NAME_SUFFIXED_LABELS.has(label)
      ? `${BADGE_LABELS[label]} · ${name.trim()}`
      : BADGE_LABELS[label];
  return `Ownership: ${named}. Open details.`;
}

/**
 * Static UI strings for the ownership-chain list in the panel (§18.3). Section
 * heading + the "not disclosed" fallback live here, not inline in the component,
 * so ALL user-facing copy stays in the single reviewed module (CLAUDE.md rule 2).
 */
export const CHAIN_COPY = {
  heading: "Ownership chain",
  effectiveFromPrefix: "since",
  // Temporal ownership history (Track A). The "Ownership over time" section lists
  // ownership periods newest-first; each line is composed from these + the
  // reviewed `ownershipMechanismText`. All neutral, structural, §23.1-safe:
  // `previouslyPrefix` marks a prior (superseded) period; `currentLabel` marks
  // the current one; `dateRangeSeparator` joins a from–to range; `dateUndisclosed`
  // is the honest fallback when a date is not publicly documented (never inferred).
  historyHeading: "Ownership over time",
  previouslyPrefix: "previously",
  currentLabel: "current",
  dateRangeSeparator: "–",
  dateUndisclosed: "date not publicly disclosed",
  // Ownership-lineage RAIL (M3 popup redesign). The rail renders the chain as a
  // connected vertical provenance record: the ULTIMATE owner at the top, each
  // intermediate owner below it, and the CHANNEL pinned at the base. These tags
  // label the two endpoints; neutral and structural (§23.1) — the "ultimate
  // owner" tag names the top of the chain as public fact, and "this channel"
  // simply marks the base node as the channel being viewed.
  lineageHeading: "Ownership lineage",
  ultimateTag: "ultimate owner",
  thisChannelTag: "this channel",
  // Printed-record popup (M3 dossier redesign). The record lists owners under a
  // quiet "Ownership" label and prior owners under "Over time"; `presentLabel`
  // closes an open-ended (still-current) period as a from–now range. Neutral,
  // structural (§23.1) — a date word, not a claim.
  overTimeHeading: "Over time",
  presentLabel: "now",
} as const;

/**
 * Static strings for the toolbar popup (SPEC §18.1). The popup is the ONLY UI:
 * the extension injects nothing into YouTube. When opened on a watch page it
 * shows the currently-playing video's ownership box; otherwise a friendly
 * prompt. These are chrome/status strings kept in the reviewed module so no
 * user-facing copy is inlined in the component (CLAUDE.md rule 2). `title` and
 * `description` are also consumed as the public site's document metadata
 * (`apps/web`), so `description` stays a neutral, badge-free product summary.
 */
export const POPUP_COPY = {
  title: "CHANNELWATCH",
  /** Masthead qualifier — names the popup as a printed ownership record. */
  recordType: "ownership record",
  description:
    "Shows who owns, finances, or operates the YouTube channel you're watching, with sourced, human-reviewed evidence.",
  /** Shown while the lookup is in flight. */
  loading: "Looking up this channel…",
  /** Replaces `loading` when the request is slow (e.g. a cold-start server). */
  slowLoading: "Still working — the lookup server may be waking up.",
  /** Friendly prompt on the homepage / channel pages / non-YouTube tabs. */
  notWatchPage: "Open a YouTube video to see who owns its channel.",
  /** Watch page, but the channel could not be read from the page yet. */
  channelUnresolved:
    "Couldn't read this video's channel yet. Give the page a moment to finish loading, then reopen this popup.",
  /** The lookup failed (network/API error). */
  lookupError: "Ownership information couldn't be loaded right now. Please try again later.",
} as const;

/**
 * Static UI strings for the PUBLIC SITE (`apps/web`, M3 Track C): navigation,
 * the home/search page, and the channel-page section headings + empty/error
 * states. Kept here — not inline in the pages — so ALL user-facing copy stays in
 * the single reviewed module (CLAUDE.md rule 2). The home blurb is derived from
 * the MANIFESTO and follows §23.1 safer language: it describes what the project
 * does, separates ownership / control / influence, and admits uncertainty; it
 * never asserts misconduct or editorial control.
 */
export const SITE_COPY = {
  homeHeading: "Who owns the channels you watch?",
  homeBlurb: [
    "CHANNELWATCH shows YouTube viewers who owns, finances, or operates the channels they watch. Every published claim is supported by public evidence and reviewed by a person before it appears.",
    "We describe ownership structure as public fact, and we keep financial ownership, operational control, and creative influence separate. Acquisition is not guilt; investment is not proof of editorial control. When the evidence is thin, the honest answer is that ownership is unknown.",
  ],
  searchHeading: "Find a channel",
  searchLabel: "Search researched channels",
  searchPlaceholder: "Channel name or handle",
  searchButton: "Search",
  searchPrompt: "Search for a channel to see what public records indicate about its ownership.",
  searchResultsHeading: "Matching channels",
  searchNoResults: "No researched channels match that search yet.",
  navHome: "Home",
  navMethodology: "Methodology",
  navCorrections: "Report an error",
  overviewHeading: "Ownership overview",
  evidenceHeading: "Evidence",
  evidenceEmpty: "No sources have been recorded for this channel yet.",
  timelineHeading: "Timeline",
  timelineEmpty: "No dated ownership events have been recorded for this channel yet.",
  timelineUndated: "Date not publicly disclosed",
  lookupError:
    "This channel's ownership information could not be loaded right now. Please try again later.",
  unresearchedHeading: "Not yet researched",
  methodologyLinkText: "How we research ownership",
  reportErrorIntro:
    "Spotted something inaccurate? Anyone — creators, companies, or members of the public — can ask us to review a published record.",
  backToSearch: "Back to search",
} as const;

/**
 * Static strings for the standalone `/corrections` page (SPEC §23.3 "Report an
 * Error"). The form itself reuses `PANEL_COPY` for the shared fields
 * (explanation / name / email / relationship / submit) and `CORRECTION_RECEIVED`
 * for the acknowledgement; only the page-level heading/intro and the channel-ID
 * field (which the in-panel form does not need — the extension already knows the
 * channel) live here. Neutral, §23.1-safe.
 */
export const CORRECTION_PAGE_COPY = {
  heading: "Report an error",
  intro:
    "Use this form to dispute a specific published record. Corrections are logged, reviewed, and — where a record changes — kept visible rather than silently rewritten.",
  channelIdLabel: "YouTube channel ID (required)",
  channelIdPlaceholder: "UC…",
  channelIdInvalid: "Enter a valid YouTube channel ID: UC followed by 22 characters.",
} as const;

/**
 * The public methodology page content (`/methodology`, M3 Track C), a faithful
 * structured rendering of `docs/METHODOLOGY.md`. Wording tracks that reviewed
 * doc (itself adapted from the founding spec); kept here so the page inlines no
 * prose of its own (CLAUDE.md rule 2). Purely descriptive of how evidence is
 * weighed and reviewed — asserts nothing about any specific channel (§23.1).
 */
export const METHODOLOGY_COPY = {
  heading: "How we research ownership",
  intro:
    "This page describes how CHANNELWATCH gathers evidence, weighs it, expresses confidence and uncertainty, reviews claims, and decides what may be published. Detection is evidence-first: the published ownership status is assembled from discrete, sourced claims that have passed human review, never from a single unexplained score.",
  evidenceTiersHeading: "Evidence hierarchy",
  evidenceTiersIntro:
    "Every source is assigned to one of four tiers. Tier determines how much weight a source may carry and whether it can support a published claim at all.",
  evidenceTiers: [
    {
      title: "Tier 1 — Primary authoritative sources",
      description:
        "Securities filings, corporate registries, official acquisition announcements, investor portfolio pages, official ownership disclosures, court and bankruptcy records, government competition filings, and official statements by the creator or acquiring company.",
    },
    {
      title: "Tier 2 — Reputable secondary sources",
      description:
        "Established business and trade publications, interviews with named executives, investigative journalism, financial databases with clear sourcing, and industry newsletters with accountable authorship.",
    },
    {
      title: "Tier 3 — Supporting technical evidence",
      description:
        "Historical website ownership pages, domain registration changes, shared legal contact information, shared advertising disclosures, shared corporate addresses, public employment records, app-store publisher changes, and archived terms-of-service pages.",
    },
    {
      title: "Tier 4 — Leads only",
      description:
        "Social-media speculation, forum posts, anonymous tips, sudden stylistic changes, similar thumbnails, shared sponsors, upload-pattern changes, and unverified leaked screenshots. Tier 4 evidence may initiate research but must never independently support a published ownership claim.",
    },
  ],
  confidenceHeading: "Confidence levels",
  confidenceIntro:
    "Each claim receives an evidence classification and a confidence level. Uncertainty is first-class: “Unknown” is a valid, common, and honest outcome, and must never be presented as suspicion.",
  confidenceLevels: [
    {
      title: "Confirmed",
      description:
        "The relationship is established through strong primary evidence, such as a corporate filing, official acquisition announcement, owner portfolio listing, or direct creator confirmation.",
    },
    {
      title: "High confidence",
      description: "Multiple credible sources agree and no material contradiction exists.",
    },
    {
      title: "Moderate confidence",
      description:
        "Credible evidence exists but the exact ownership or control terms remain incomplete.",
    },
    {
      title: "Low confidence",
      description: "Evidence is suggestive but insufficient for a public ownership label.",
    },
    {
      title: "Disputed",
      description: "Credible parties provide conflicting accounts.",
    },
    {
      title: "Unknown",
      description: "Insufficient evidence exists.",
    },
  ],
  thresholdsHeading: "Publication thresholds",
  thresholdsIntro:
    "The scoring model estimates confidence in a specific claim — not whether a company is “good” or “bad”. Scores map to bands:",
  thresholds: [
    "0.90–1.00 — Confirmed",
    "0.75–0.89 — High confidence",
    "0.55–0.74 — Moderate confidence",
    "0.30–0.54 — Low confidence",
    "0.00–0.29 — Research lead only (not publishable)",
  ],
  peRuleHeading: "The PE-backed label",
  peRule:
    "A publicly visible PE-backed label requires at least one Tier 1 source, or two independent Tier 2 sources plus strong entity resolution. PE-backed is an orange badge describing ownership structure — never a red badge, and never an implication of misconduct.",
  reviewHeading: "Review process",
  reviewIntro: "Before publishing an ownership claim, a reviewer must:",
  reviewChecklist: [
    "Confirm the exact channel ID.",
    "Confirm the company or entity identity.",
    "Confirm the relationship type.",
    "Confirm the effective date.",
    "Confirm whether the transaction closed.",
    "Confirm whether the relationship is still current.",
    "Confirm whether private-equity involvement is direct or indirect.",
    "Confirm whether control is known.",
    "Search for contradictory evidence.",
    "Check whether the creator publicly disputed the claim.",
    "Use neutral wording.",
    "Attach at least one strong source.",
    "Record reviewer reasoning.",
  ],
  twoPersonHeading: "Two-person review",
  twoPersonIntro:
    "Two reviewers must approve before publication for high-risk claims involving hidden ownership, undisclosed acquisition, fraud, misrepresentation, editorial interference, political influence, or named individuals.",
  llmHeading: "How we use language models",
  llm: "Language models may assist research — summarizing announcements, extracting names and dates, suggesting entity matches — but must not act as autonomous publishers. Models draft; humans publish. Model confidence is never treated as factual confidence, and no claim is published without human review.",
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

/**
 * Static UI strings for the authenticated `/review` console (SPEC §19.5, §20).
 * The console is internal (reviewers only), but its copy still lives in the
 * single reviewed module rather than inline in components (CLAUDE.md rule 2), so
 * every user-facing string — including the sensitive-claim / two-person-review
 * language (§20.3) — is reviewed in one place and stays §23.1-neutral. No string
 * here asserts wrongdoing; a "sensitive" claim is a review-process flag, not an
 * accusation.
 */
export const REVIEW_CONSOLE_COPY = {
  consoleTitle: "Review Console",
  loading: "Loading…",
  // Navigation.
  navQueue: "Queue",
  navEntities: "Entities",
  navCorrections: "Corrections",
  navAudit: "Audit",
  navSignOut: "Sign out",
  // Login.
  loginHeading: "Reviewer sign in",
  loginEmailLabel: "Email",
  loginPasswordLabel: "Password",
  loginSubmit: "Sign in",
  loginSubmitting: "Signing in…",
  loginError: "Sign in failed. Check your email and password.",
  signedInAs: "Signed in as",
  // Claim queue.
  queueHeading: "Claim queue",
  queueFilterLabel: "Filter by status",
  queueFilterAll: "All statuses",
  queueEmpty: "No claims match this filter.",
  colClaim: "Claim",
  colStatus: "Status",
  colConfidence: "Confidence",
  colReviews: "Reviews",
  colFlags: "Flags",
  colActions: "Actions",
  // Two-person review (§20.3) — a process flag, never an accusation.
  sensitiveFlag: "Second review required",
  sensitiveExplanation:
    "This claim is flagged for two-person review. A second, distinct reviewer must approve it before it can be published.",
  awaitingSecondReviewer: "Approved once; awaiting a second distinct reviewer.",
  readyToPublish: "Approvals complete; approving will publish.",
  // Review actions.
  approve: "Approve",
  reject: "Reject",
  reviewDialogApproveHeading: "Approve claim",
  reviewDialogRejectHeading: "Reject claim",
  reasoningLabel: "Reviewer reasoning (required)",
  reasoningPlaceholder: "Record the evidence basis and your decision (at least 10 characters).",
  reasoningTooShort: "Please record at least 10 characters of reasoning.",
  confirm: "Confirm",
  cancel: "Cancel",
  actionError: "The action could not be completed. Please try again.",
  // Entities.
  entitiesHeading: "Entities",
  entityNewButton: "New entity",
  entityEdit: "Edit",
  entityCanonicalNameLabel: "Canonical name",
  entityTypeLabel: "Type",
  entityLegalNameLabel: "Legal name",
  entityJurisdictionLabel: "Jurisdiction",
  entityWebsiteLabel: "Website",
  entityDescriptionLabel: "Description",
  entitySave: "Save",
  entitySaving: "Saving…",
  entityCreateHeading: "Create entity",
  entityEditHeading: "Edit entity",
  entitiesEmpty: "No entities yet.",
  // Corrections inbox.
  correctionsHeading: "Correction inbox",
  correctionsEmpty: "No correction requests match this filter.",
  correctionResolve: "Resolve",
  correctionDismiss: "Dismiss",
  correctionResolveHeading: "Resolve correction",
  correctionDismissHeading: "Dismiss correction",
  resolutionLabel: "Resolution note (required)",
  resolutionPlaceholder: "Record how this correction was handled (at least 10 characters).",
  colSubmitted: "Submitted",
  colExplanation: "Explanation",
  colRelationship: "Relationship",
  // Audit viewer.
  auditHeading: "Audit events",
  auditFilterLabel: "Filter by subject id",
  auditFilterApply: "Apply",
  auditEmpty: "No audit events match this filter.",
  colWhen: "When",
  colActor: "Actor",
  colAction: "Action",
  colObject: "Object",
  prev: "Previous",
  next: "Next",
} as const;

/**
 * The public `/legal` page (M3 Track F, launch-checklist item 1.12): the
 * notice-and-takedown process and the standing content-dispute path. The
 * designated-agent contact is a PLACEHOLDER that a human must replace after
 * registering an agent with the US Copyright Office — the page renders it
 * verbatim, so launch is blocked on that edit (see docs/launch-checklist.md).
 * Neutral, §23.1-safe: describes process, asserts nothing about any channel.
 */
export const LEGAL_PAGE_COPY = {
  heading: "Legal notices",
  intro:
    "CHANNELWATCH publishes structural ownership information supported by public evidence. This page describes how to send a formal legal notice about published content and how to dispute a record.",
  disputeHeading: "Disputing a published record",
  disputeBody:
    "If you believe a published record is inaccurate, the fastest path is the correction form. Corrections are logged, reviewed by a person, and — where a record changes — kept visible rather than silently rewritten. Records under credible dispute can carry a public dispute notice while review is underway.",
  disputeLinkText: "Report an error",
  dmcaHeading: "Copyright notices (DMCA)",
  dmcaBody:
    "If you believe content on this site infringes your copyright, you may send a notice under the Digital Millennium Copyright Act (17 U.S.C. § 512) to our designated agent. A valid notice must identify the copyrighted work, identify the material claimed to be infringing with enough detail for us to locate it, include your contact information, a statement of good-faith belief that the use is unauthorized, a statement under penalty of perjury that the notice is accurate and that you are authorized to act, and a physical or electronic signature.",
  dmcaProcessBody:
    "On receiving a valid notice we will review it promptly, remove or disable access to the identified material where required, and notify the affected submitter where applicable. Counter-notices are handled per the statute.",
  agentHeading: "Designated agent",
  agentContact:
    "[NEEDS-HUMAN: designated agent name and contact — register with the US Copyright Office and replace this placeholder before launch]",
  navLegal: "Legal",
} as const;

/**
 * The public privacy-policy page (`/privacy`, M3 Track F). The Chrome Web Store
 * requires a public privacy-policy URL, and this page is that URL. It is a
 * faithful structured rendering of the reviewed `PRIVACY.md` (itself adapted
 * from Spec §22) — kept here so the page inlines no prose of its own (CLAUDE.md
 * rule 2). Purely descriptive of data handling; asserts nothing about any
 * channel (§23.1). Structured as sections + bullet lists so the page can render
 * it without re-authoring the substance.
 */
export const PRIVACY_PAGE_COPY = {
  heading: "Privacy Policy",
  intro:
    "CHANNELWATCH is built to give viewers context about who owns channels — not to watch the viewers. This policy is binding on the extension and backend. We reject surveillance of viewers and the collection of unnecessary browsing history.",
  sendsHeading: "What the extension sends",
  sendsIntro: "To look up a channel, the extension sends only:",
  sends: ["YouTube channel ID", "Extension version", "Requested data version"],
  sendsNote:
    "That is the complete request payload for an ownership lookup. Channels are identified by their immutable YouTube channel ID, which is all the backend needs to match a record.",
  neverHeading: "What we never collect",
  neverIntro: "The extension does not collect:",
  never: [
    "Full browsing history.",
    "Video watch duration.",
    "Search queries.",
    "Comments.",
    "Google account identity.",
    "Subscription list.",
    "Personally identifying viewer information.",
  ],
  avoidsIntro: "And it avoids sending:",
  avoids: [
    "Video ID (unless strictly required for a lookup).",
    "User identity.",
    "Full page URL.",
    "Referrer.",
    "YouTube cookies.",
  ],
  storageNote:
    "The extension stores no user data at all. It does not write to browser storage, and it keeps no history of the channels a user views. The only caching is an in-memory session cache in the background service worker that avoids re-fetching the same channel within a session; it is never persisted to disk and is gone when the service worker or browser restarts. Extension permissions are kept minimal — no storage permission, no full browsing history, no tabs permission, no scripting permission, no cookies, no identity permissions, and no access to unrelated sites. The only host access is youtube.com (to read the public channel ID on the watch page) and the fixed API origin.",
  telemetryHeading: "Telemetry",
  telemetryIntro:
    "Telemetry is disabled by default and strictly opt-in. When enabled by the user, it must be aggregated, documented, easy to disable, and free of any channel-viewing history. Users can disable extension analytics at any time. Permitted telemetry, when opted in, is limited to:",
  telemetry: [
    "Extension version.",
    "API latency.",
    "Rendering failures.",
    "Selector failures.",
    "Anonymous crash data.",
  ],
  telemetryNote: "Telemetry never includes which channels or videos a user viewed.",
  subjectsHeading: "Creator and subject data",
  subjectsBody:
    "Separately from viewer privacy, CHANNELWATCH never publishes home addresses, personal phone numbers, family information, private email addresses, confidential contracts, leaked personal documents, speculative personal wealth, or any information unrelated to ownership transparency.",
  navPrivacy: "Privacy",
} as const;
