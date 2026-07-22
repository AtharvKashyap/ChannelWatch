/**
 * Ownership badge renderer. Inserts a small, style-isolated badge next to the
 * channel name on watch and channel pages, driven entirely by the reviewed
 * schema/copy module:
 *   - the badge TEXT is `BADGE_LABELS[label]` (never free text);
 *   - the badge COLOR is the `badge_color` the API already computed
 *     (`classificationToBadgeColor` in @channelwatch/schemas), mapped to
 *     accessible CSS values inside our own shadow root — PE is ORANGE, RED is
 *     reserved for DISPUTED (CLAUDE.md rule 3).
 *
 * Isolation & safety (CLAUDE.md "fail silently"):
 *   - the badge lives inside a closed-off Shadow DOM host so YouTube's CSS can
 *     never leak in and ours can never leak out;
 *   - the host carries a stable id so a re-render tears down the old badge
 *     before inserting a new one — never two badges;
 *   - every path returns `null` rather than throwing, so a DOM surprise can
 *     never break the page.
 *
 * UNRESEARCHED channels render nothing by default. This is deliberate noise
 * reduction: the overwhelming majority of channels are unresearched, and a badge
 * on every one of them would be worthless. There is no setting to surface them
 * yet; when one is added it should gate an explicit neutral "Ownership Unclear"
 * badge here.
 */
import {
  BADGE_LABELS,
  type BadgeColor,
  type ClassificationLabel,
  type ResearchedChannelLookup,
} from "@channelwatch/schemas";
import { queryFirst, type SelectorName } from "./selectors.js";
import type { Settings } from "../shared/settings.js";
import type { LookupChannelResponse } from "../shared/messages.js";

/** Stable id on the Shadow DOM host so we can find + replace it (no duplicates). */
export const BADGE_HOST_ID = "channelwatch-badge-host";

export type PageKind = "watch" | "channel" | "other";

/** Accessible badge colors, defined inside our shadow root (§9.2 semantics).
 * All backgrounds meet WCAG AA against white text. */
const BADGE_PALETTE: Record<BadgeColor, { bg: string; fg: string }> = {
  NEUTRAL: { bg: "#5f6368", fg: "#ffffff" },
  GREEN: { bg: "#1e7e34", fg: "#ffffff" },
  BLUE: { bg: "#1565c0", fg: "#ffffff" },
  PURPLE: { bg: "#6a1b9a", fg: "#ffffff" },
  ORANGE: { bg: "#a85400", fg: "#ffffff" },
  RED: { bg: "#b71c1c", fg: "#ffffff" },
};

/** Classify the current page from its URL (used for scope + anchor selection). */
export function pageKindFromUrl(url: string): PageKind {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return "other";
  }
  if (path === "/watch" || path.startsWith("/shorts/")) return "watch";
  if (
    path.startsWith("/channel/") ||
    path.startsWith("/@") ||
    path.startsWith("/c/") ||
    path.startsWith("/user/")
  ) {
    return "channel";
  }
  return "other";
}

export interface BadgeDecision {
  label: ClassificationLabel;
  color: BadgeColor;
}

/**
 * Decide whether a badge should render and, if so, with what label/color —
 * purely from the lookup response + settings. Returns `null` for "show nothing".
 * (Scope/anchor concerns are handled by `renderBadge`; this is content-only.)
 */
export function resolveBadgeDecision(
  response: LookupChannelResponse | null,
  settings: Settings,
): BadgeDecision | null {
  if (!response || !response.ok) return null;
  const payload = response.payload;
  // UNRESEARCHED → nothing (default off; documented at the top of this file).
  if (!payload.researched) return null;

  const researched = payload as ResearchedChannelLookup;
  const label = researched.classification.label;

  if (settings.onlyConfirmed && researched.classification.confidence_label !== "CONFIRMED") {
    return null;
  }
  if (settings.hideCreatorOwnedBadges && label === "CREATOR_OWNED") {
    return null;
  }

  return { label, color: researched.badge_color };
}

/** The badge anchor for a page kind, or null on pages we don't badge. */
function anchorFor(doc: Document, pageKind: PageKind): Element | null {
  const name: SelectorName | null =
    pageKind === "watch"
      ? "watchBadgeAnchor"
      : pageKind === "channel"
        ? "channelBadgeAnchor"
        : null;
  if (!name) return null;
  return queryFirst(doc, name);
}

/** Remove any mounted badge. Safe to call when nothing is mounted. */
export function removeBadge(doc: Document): void {
  try {
    for (const el of doc.querySelectorAll(`#${BADGE_HOST_ID}`)) el.remove();
  } catch {
    // never throw into the page
  }
}

export interface RenderBadgeParams {
  doc: Document;
  url: string;
  response: LookupChannelResponse | null;
  settings: Settings;
  /** Called with the researched payload when the badge is activated (opens the panel). */
  onActivate?: (payload: ResearchedChannelLookup) => void;
}

/**
 * Render (or clear) the badge. Always tears down the previous badge first, then
 * inserts a fresh one iff the decision + settings + page + anchor all allow it.
 * Returns the host element, or `null` when nothing was rendered.
 */
export function renderBadge(params: RenderBadgeParams): HTMLElement | null {
  const { doc, url, response, settings, onActivate } = params;
  try {
    // Teardown first — this is what makes double-render idempotent and makes a
    // null/clear response actually clear the badge.
    removeBadge(doc);

    const decision = resolveBadgeDecision(response, settings);
    if (!decision) return null;

    const pageKind = pageKindFromUrl(url);
    // Scope: "watch_and_channel_only" suppresses the badge anywhere else. (Under
    // "everywhere" we still only have watch/channel anchors today; grid/thumbnail
    // badges are future work.)
    if (settings.badgeScope === "watch_and_channel_only" && pageKind === "other") return null;
    if (pageKind === "other") return null;

    const anchor = anchorFor(doc, pageKind);
    if (!anchor) return null;

    const host = buildHost(doc, decision, response, onActivate);
    anchor.appendChild(host);
    return host;
  } catch (err) {
    // Fail-silent: a DOM surprise must never break YouTube.
    console.debug("[channelwatch] renderBadge failed", err);
    return null;
  }
}

function buildHost(
  doc: Document,
  decision: BadgeDecision,
  response: LookupChannelResponse | null,
  onActivate?: (payload: ResearchedChannelLookup) => void,
): HTMLElement {
  const host = doc.createElement("span");
  host.id = BADGE_HOST_ID;
  const shadow = host.attachShadow({ mode: "open" });

  const { bg, fg } = BADGE_PALETTE[decision.color];
  const style = doc.createElement("style");
  style.textContent = `
    :host { all: initial; display: inline-flex; vertical-align: middle; }
    .cw-badge {
      --cw-badge-bg: ${bg};
      --cw-badge-fg: ${fg};
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 6px;
      padding: 2px 8px;
      border: 0;
      border-radius: 999px;
      background: var(--cw-badge-bg);
      color: var(--cw-badge-fg);
      font: 500 12px/1.4 "Roboto", "Arial", sans-serif;
      cursor: pointer;
      white-space: nowrap;
    }
    .cw-badge:focus-visible { outline: 2px solid var(--cw-badge-fg); outline-offset: 1px; }
  `;
  shadow.appendChild(style);

  const label = BADGE_LABELS[decision.label];
  const badge = doc.createElement("button");
  badge.type = "button";
  badge.className = "cw-badge";
  badge.setAttribute("data-cw-color", decision.color);
  badge.setAttribute("aria-label", `Ownership: ${label}. Open details.`);
  badge.textContent = label;

  badge.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (response && response.ok && response.payload.researched && onActivate) {
      onActivate(response.payload as ResearchedChannelLookup);
    }
  });

  shadow.appendChild(badge);
  return host;
}
