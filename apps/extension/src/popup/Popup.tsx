/**
 * Toolbar popup — the extension's ONLY user interface (the M3 redesign removed
 * all page injection). On open it determines whether the active tab is a
 * YouTube WATCH page; if so it resolves the currently-playing video's channel
 * (via the minimal content script) and looks up its ownership record (via the
 * background SW), then renders the ownership record.
 *
 * The look is a PRINTED OWNERSHIP RECORD, not a dashboard card: a quiet masthead
 * over a hairline, a serif (Newsreader) channel headline, the verdict as a plain
 * sentence, and the ownership chain as a simple indented list. Ink on warm
 * paper; the sole spot of color (the classification accent) is a whisper — a 2px
 * underline under the channel name and the "Report an error" link. Layout:
 *   - masthead ("CHANNELWATCH · ownership record") + a hairline;
 *   - the channel name (serif, accent-underlined), the verdict SENTENCE, and the
 *     fuller `classification.summary`;
 *   - "Ownership" — the owner chain as an indented list (owner name + a small
 *     mono meta line: mechanism · stake · since date), the ultimate owner flagged
 *     inline with an em dash;
 *   - "Over time" — the ownership history in the same list idiom (only if present);
 *   - "Notes" — the §9.4 warning codes (only if present);
 *   - one quiet mono line (confidence · evidence · creator status · last reviewed);
 *   - a hairline, the standing editorial disclaimer, and the correction LINK.
 *
 * Every user-facing string comes from `@channelwatch/schemas` (CLAUDE.md rule
 * 2). The popup submits nothing and stores nothing (privacy, CLAUDE.md rule 5).
 */
import { useEffect, useState } from "react";
import {
  CHAIN_COPY,
  CONFIDENCE_LABEL_TEXT,
  CREATOR_STATUS_TEXT,
  CORRECTION_CTA,
  EDITORIAL_DISCLAIMER,
  EXPLANATION_TEXT,
  PANEL_COPY,
  POPUP_COPY,
  UNRESEARCHED_SUMMARY,
  VERDICT_SENTENCE,
  badgeAriaLabel,
  classificationToBadgeColor,
  evidenceCountText,
  lastReviewedText,
  ownershipMechanismText,
  ownershipStakeText,
  type ClassificationLabel,
  type OwnershipChainStep,
  type OwnershipHistoryEntry,
  type ResearchedChannelLookup,
} from "@channelwatch/schemas";
import type { LookupChannelResponse } from "../shared/messages.js";
import { correctionUrl } from "../shared/config.js";

/** Watch pages only (CLAUDE.md constraint): `/watch`, `/shorts/…`, `/live/…`. */
function isWatchUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.hostname !== "www.youtube.com" && u.hostname !== "m.youtube.com") return false;
    const p = u.pathname;
    return p === "/watch" || p.startsWith("/shorts/") || p.startsWith("/live/");
  } catch {
    return false;
  }
}

/** Injectable side-effects so the component is unit-testable without a real `chrome`. */
export interface PopupDeps {
  /** URL of the active tab (null when unavailable / permission not granted). */
  getActiveTabUrl: () => Promise<string | null>;
  /** Resolve the current watch-page channel id via the content script (null on failure). */
  resolveChannel: () => Promise<string | null>;
  /** Look up an ownership record via the background SW. */
  lookup: (channelId: string) => Promise<LookupChannelResponse>;
  /** Open the public correction form for a channel (new tab). */
  openCorrection: (channelId: string) => void;
  /** How long a lookup may run before the "slow / cold start" message shows. */
  slowAfterMs?: number;
}

type ViewState =
  | { kind: "loading"; slow: boolean }
  | { kind: "not_watch" }
  | { kind: "unresolved" }
  | { kind: "error" }
  | { kind: "unresearched" }
  | { kind: "researched"; payload: ResearchedChannelLookup; channelId: string };

export function Popup({ deps }: { deps: PopupDeps }) {
  const [state, setState] = useState<ViewState>({ kind: "loading", slow: false });

  useEffect(() => {
    let cancelled = false;
    const slowTimer = setTimeout(() => {
      if (!cancelled) {
        setState((s) => (s.kind === "loading" ? { kind: "loading", slow: true } : s));
      }
    }, deps.slowAfterMs ?? 1500);

    async function run() {
      try {
        const url = await deps.getActiveTabUrl();
        if (cancelled) return;
        if (!isWatchUrl(url)) {
          setState({ kind: "not_watch" });
          return;
        }

        const channelId = await deps.resolveChannel();
        if (cancelled) return;
        if (!channelId) {
          setState({ kind: "unresolved" });
          return;
        }

        const response = await deps.lookup(channelId);
        if (cancelled) return;
        if (!response.ok) {
          setState({ kind: "error" });
          return;
        }
        if (!response.payload.researched) {
          setState({ kind: "unresearched" });
          return;
        }
        setState({ kind: "researched", payload: response.payload, channelId });
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    }

    void run();
    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
  }, [deps]);

  return (
    <main className="cw-doc" data-cw-color={docColor(state)}>
      <style>{POPUP_STYLE}</style>
      <p className="cw-masthead">
        {POPUP_COPY.title}
        <span className="cw-masthead__dot" aria-hidden="true"> · </span>
        {POPUP_COPY.recordType}
      </p>
      <hr className="cw-rule" />
      <Body state={state} openCorrection={deps.openCorrection} />
    </main>
  );
}

/** The verdict accent color for the whole record; NEUTRAL for the chrome states. */
function docColor(state: ViewState): string {
  if (state.kind === "researched") return classificationToBadgeColor(state.payload.classification.label);
  return "NEUTRAL";
}

function Body({
  state,
  openCorrection,
}: {
  state: ViewState;
  openCorrection: (channelId: string) => void;
}) {
  switch (state.kind) {
    case "loading":
      return (
        <p role="status" className="cw-note">
          {state.slow ? POPUP_COPY.slowLoading : POPUP_COPY.loading}
        </p>
      );
    case "not_watch":
      return <p className="cw-note">{POPUP_COPY.notWatchPage}</p>;
    case "unresolved":
      return <p className="cw-note">{POPUP_COPY.channelUnresolved}</p>;
    case "error":
      return (
        <p role="alert" className="cw-note">
          {POPUP_COPY.lookupError}
        </p>
      );
    case "unresearched":
      return (
        <>
          <p className="cw-verdict">{PANEL_COPY.unresearchedHeading}</p>
          <p className="cw-summary">{UNRESEARCHED_SUMMARY}</p>
          <hr className="cw-rule" />
          <p className="cw-disclaimer">{EDITORIAL_DISCLAIMER}</p>
        </>
      );
    case "researched":
      return (
        <OwnershipRecord
          payload={state.payload}
          channelId={state.channelId}
          openCorrection={openCorrection}
        />
      );
  }
}

/** The operative entity name a name-suffixed verdict announces (§9.1 naming). */
function operativeName(payload: ResearchedChannelLookup): string | null {
  const label = payload.classification.label;
  if (label === "PE_BACKED") return payload.ultimate_parent?.name ?? null;
  if (label === "CORPORATE_OWNED" || label === "NONPROFIT_OWNED") {
    return payload.direct_owner?.name ?? null;
  }
  return null;
}

/** Short month names for humanizing ISO dates to "Mon YYYY". */
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Reformat a stored date for display: an ISO `YYYY-MM-DD` (or `YYYY-MM`) becomes
 * "Mon YYYY"; anything else (a bare year like "2018", or an unparseable string)
 * is returned verbatim. Null/empty → null (callers substitute the reviewed
 * `dateUndisclosed` copy where a date is expected). Never infers a date.
 */
function humanizeDate(raw: string | null | undefined): string | null {
  if (raw == null || raw.trim() === "") return null;
  const iso = raw.trim();
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?/.exec(iso);
  if (m) {
    const month = Number(m[2]);
    if (month >= 1 && month <= 12) return `${MONTHS[month - 1]} ${m[1]}`;
  }
  return iso;
}

/** One owner row in the "Ownership" list (owner name + mono meta line). */
interface OwnerRow {
  key: string;
  name: string;
  meta: string | null;
  /** The top of the chain, flagged inline "— ultimate owner". */
  ultimate: boolean;
}

/**
 * Build the owner list, channel→up (direct owner first, ultimate last). We use
 * `ownership_chain` (already ordered channel-owner upward) when present and flag
 * its top-most (last) node as the ultimate owner; otherwise we synthesize rows
 * from `direct_owner` / `ultimate_parent` so no existing data is dropped.
 */
function buildOwners(payload: ResearchedChannelLookup): OwnerRow[] {
  const chain = payload.ownership_chain ?? [];
  if (chain.length > 0) {
    return chain.map((step, i) => ({
      key: `chain-${i}-${step.name}`,
      name: step.name,
      meta: ownerMetaText(step),
      ultimate: i === chain.length - 1,
    }));
  }

  const rows: OwnerRow[] = [];
  if (payload.direct_owner) {
    rows.push({
      key: "direct",
      name: payload.direct_owner.name,
      meta: payload.direct_owner.mechanism ?? null,
      ultimate: false,
    });
  }
  if (payload.ultimate_parent && payload.ultimate_parent.name !== payload.direct_owner?.name) {
    rows.push({
      key: "ultimate",
      name: payload.ultimate_parent.name,
      meta: null,
      ultimate: true,
    });
  } else if (rows.length > 0) {
    // A single owner that is also the top of the (empty) chain reads as ultimate.
    rows[rows.length - 1]!.ultimate = true;
  }
  return rows;
}

function ownerMetaText(step: OwnershipChainStep): string {
  const mechanism = ownershipMechanismText(step.relationship, step.control_level);
  const stake = ownershipStakeText(step.ownership_percentage);
  const humanFrom = humanizeDate(step.effective_from);
  const date = humanFrom ? `${CHAIN_COPY.effectiveFromPrefix} ${humanFrom}` : "";
  return [mechanism, stake, date].filter(Boolean).join(" · ");
}

/** The single-line "Over time" meta: [current ·] from–to (dates humanized). */
function historyMetaText(entry: OwnershipHistoryEntry): string {
  const marker = entry.is_current ? CHAIN_COPY.currentLabel : null;
  return [marker, dateRangeText(entry)].filter(Boolean).join(" · ");
}

function dateRangeText(entry: OwnershipHistoryEntry): string {
  if (entry.effective_from === null && entry.effective_to === null) {
    return CHAIN_COPY.dateUndisclosed;
  }
  const from = humanizeDate(entry.effective_from) ?? CHAIN_COPY.dateUndisclosed;
  const to = entry.effective_to
    ? humanizeDate(entry.effective_to)
    : entry.is_current
      ? CHAIN_COPY.presentLabel
      : null;
  return to === null ? from : `${from}${CHAIN_COPY.dateRangeSeparator}${to}`;
}

function OwnershipRecord({
  payload,
  channelId,
  openCorrection,
}: {
  payload: ResearchedChannelLookup;
  channelId: string;
  openCorrection: (channelId: string) => void;
}) {
  const label: ClassificationLabel = payload.classification.label;
  const owners = buildOwners(payload);
  const history = payload.ownership_history ?? [];

  // One quiet mono line, per the printed-record layout: confidence · evidence ·
  // creator status · last reviewed (date humanized to "Mon YYYY" for display).
  const facts = [
    CONFIDENCE_LABEL_TEXT[payload.classification.confidence_label],
    evidenceCountText(payload.evidence_count),
    payload.creator_status ? CREATOR_STATUS_TEXT[payload.creator_status.status] : null,
    lastReviewedText(humanizeDate(payload.last_reviewed_at)),
  ].filter((v): v is string => v != null);

  return (
    <article className="cw-record">
      <header className="cw-head" aria-label={badgeAriaLabel(label, operativeName(payload))}>
        <h1 className="cw-channel">
          <span className="cw-channel__name">{payload.display_name}</span>
        </h1>
        <p className="cw-verdict">{VERDICT_SENTENCE[label]}</p>
        <p className="cw-summary">{payload.classification.summary}</p>
      </header>

      {owners.length > 0 && (
        <section className="cw-section">
          <h2 className="cw-label">{PANEL_COPY.panelTitle}</h2>
          <ul className="cw-list">
            {owners.map((owner) => (
              <li key={owner.key} className="cw-entry">
                <p className="cw-entry__name">
                  {owner.name}
                  {owner.ultimate && (
                    <span className="cw-entry__flag"> {"—"} {CHAIN_COPY.ultimateTag}</span>
                  )}
                </p>
                {owner.meta && <p className="cw-entry__meta">{owner.meta}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <section className="cw-section">
          <h2 className="cw-label">{CHAIN_COPY.overTimeHeading}</h2>
          <ul className="cw-list">
            {history.map((entry, i) => (
              <li key={`${entry.name}-${i}`} className="cw-entry cw-history">
                <span className="cw-entry__name">{entry.name}</span>
                <span className="cw-entry__meta cw-entry__meta--inline">
                  {" "}
                  {"—"} {historyMetaText(entry)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {payload.warnings.length > 0 && (
        <section className="cw-section">
          <h2 className="cw-label">{PANEL_COPY.warningsLabel}</h2>
          <ul className="cw-list">
            {payload.warnings.map((code) => (
              <li key={code} className="cw-entry">
                <p className="cw-note-item">{EXPLANATION_TEXT[code]}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="cw-facts">{facts.join(" · ")}</p>

      <hr className="cw-rule" />
      <p className="cw-disclaimer">{EDITORIAL_DISCLAIMER}</p>
      <a
        className="cw-report"
        href={correctionUrl(channelId)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.preventDefault();
          openCorrection(channelId);
        }}
      >
        {CORRECTION_CTA}
        <span className="cw-report__arrow" aria-hidden="true"> {"→"}</span>
      </a>
    </article>
  );
}

const POPUP_STYLE = `
  @font-face {
    font-family: "Newsreader";
    font-style: normal;
    font-weight: 400;
    font-display: swap;
    src: url("/fonts/newsreader-400.woff2") format("woff2");
  }
  @font-face {
    font-family: "Newsreader";
    font-style: normal;
    font-weight: 600;
    font-display: swap;
    src: url("/fonts/newsreader-600.woff2") format("woff2");
  }

  .cw-doc {
    --cw-paper: #FBFAF6;
    --cw-ink: #1A1815;
    --cw-muted: #6E685C;
    --cw-hairline: #DAD4C6;
    --cw-accent: #5F5A50;
    width: 360px;
    padding: 16px 18px 18px;
    box-sizing: border-box;
    font: 400 13px/1.55 "Newsreader", Georgia, "Times New Roman", serif;
    color: var(--cw-ink);
    background: var(--cw-paper);
    -webkit-font-smoothing: antialiased;
    animation: cw-fade 120ms ease-out both;
  }
  .cw-doc * { box-sizing: border-box; }

  @keyframes cw-fade { from { opacity: 0; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    .cw-doc { animation: none; }
  }

  /* Classification accent — the ONLY color, used as a whisper. §9.2: PE = ORANGE;
     RED reserved for DISPUTED. */
  .cw-doc[data-cw-color="GREEN"]   { --cw-accent: #1E7E34; }
  .cw-doc[data-cw-color="BLUE"]    { --cw-accent: #1565C0; }
  .cw-doc[data-cw-color="PURPLE"]  { --cw-accent: #6A1B9A; }
  .cw-doc[data-cw-color="ORANGE"]  { --cw-accent: #9A4B00; }
  .cw-doc[data-cw-color="RED"]     { --cw-accent: #B3261E; }
  .cw-doc[data-cw-color="NEUTRAL"] { --cw-accent: #5F5A50; }

  /* Masthead: quiet, in the serif, over a single hairline. */
  .cw-masthead {
    margin: 0 0 9px;
    font-size: 11.5px;
    font-weight: 400;
    color: var(--cw-muted);
  }
  .cw-masthead__dot { color: var(--cw-hairline); }

  .cw-rule {
    height: 0;
    margin: 0;
    border: 0;
    border-top: 1px solid var(--cw-hairline);
  }

  .cw-note { margin: 12px 0 0; color: var(--cw-ink); }

  /* Header: serif channel headline (accent underline), verdict sentence, summary. */
  .cw-head { margin: 14px 0 0; }
  .cw-channel { margin: 0; font-weight: 600; font-size: 22px; line-height: 1.15; }
  .cw-channel__name {
    display: inline;
    border-bottom: 2px solid var(--cw-accent);
    padding-bottom: 1px;
  }
  .cw-verdict {
    margin: 10px 0 0;
    font-size: 16px;
    font-weight: 400;
    line-height: 1.35;
  }
  .cw-summary {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--cw-muted);
    line-height: 1.5;
  }

  /* Sections: a quiet serif label over an indented list. No eyebrows, no chips. */
  .cw-section { margin: 16px 0 0; }
  .cw-label {
    margin: 0 0 5px;
    font-size: 14px;
    font-weight: 600;
    color: var(--cw-ink);
  }
  .cw-list { list-style: none; margin: 0; padding: 0 0 0 14px; }
  .cw-entry { margin: 0 0 7px; }
  .cw-entry:last-child { margin-bottom: 0; }
  .cw-entry__name { margin: 0; font-size: 14px; line-height: 1.35; }
  .cw-entry__flag { color: var(--cw-muted); }
  .cw-history { line-height: 1.4; }

  /* Raw data tokens (dates, %, mechanisms): small, muted, monospace. */
  .cw-entry__meta {
    margin: 1px 0 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    color: var(--cw-muted);
  }
  .cw-entry__meta--inline { margin: 0; font-size: 11px; }

  .cw-note-item { margin: 0; font-size: 13px; color: var(--cw-ink); line-height: 1.45; }

  /* The single quiet mono line of provenance facts. */
  .cw-facts {
    margin: 16px 0 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    line-height: 1.6;
    color: var(--cw-muted);
  }

  .cw-record .cw-rule { margin-top: 16px; }

  .cw-disclaimer {
    margin: 12px 0 0;
    font-size: 12px;
    font-style: italic;
    color: var(--cw-muted);
    line-height: 1.5;
  }

  .cw-report {
    display: inline-block;
    margin: 10px 0 0;
    color: var(--cw-accent);
    font-size: 13px;
    text-decoration: none;
  }
  .cw-report:hover { text-decoration: underline; }
  .cw-report:focus-visible {
    outline: 2px solid var(--cw-accent);
    outline-offset: 3px;
    border-radius: 2px;
  }

  @media (prefers-color-scheme: dark) {
    .cw-doc {
      --cw-paper: #1B1A17;
      --cw-ink: #ECE7DC;
      --cw-muted: #A29B8C;
      --cw-hairline: #38352E;
      --cw-accent: #B0A99C;
    }
    .cw-doc[data-cw-color="GREEN"]   { --cw-accent: #6BCB77; }
    .cw-doc[data-cw-color="BLUE"]    { --cw-accent: #6FA8F0; }
    .cw-doc[data-cw-color="PURPLE"]  { --cw-accent: #C48BE6; }
    .cw-doc[data-cw-color="ORANGE"]  { --cw-accent: #E0954B; }
    .cw-doc[data-cw-color="RED"]     { --cw-accent: #F0736B; }
    .cw-doc[data-cw-color="NEUTRAL"] { --cw-accent: #B0A99C; }
  }
`;
