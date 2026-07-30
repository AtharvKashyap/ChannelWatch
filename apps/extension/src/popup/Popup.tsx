/**
 * Toolbar popup — the extension's ONLY user interface (the M3 redesign removed
 * all page injection). On open it determines whether the active tab is a
 * YouTube WATCH page; if so it resolves the currently-playing video's channel
 * (via the minimal content script) and looks up its ownership record (via the
 * background SW), then renders the ownership DOSSIER.
 *
 * The dossier answers "who's behind this channel?" as a provenance record:
 *   - a tinted VERDICT band (channel name + the reviewed classification stamp +
 *     summary), fronted by a colored left spine in the verdict color;
 *   - a vertical OWNERSHIP-LINEAGE RAIL — the ultimate owner at the top, each
 *     intermediate owner below it, and the channel pinned at the base — rendered
 *     from `ownership_chain` (which the API orders channel→up; we render
 *     base→top);
 *   - a compact monospace meta row (confidence · evidence · creator status);
 *   - the "over time" history, notes/warnings, last-reviewed line;
 *   - the standing editorial disclaimer, shown verbatim, and a "Report an error"
 *     LINK to the public correction form.
 *
 * Every user-facing string comes from `@channelwatch/schemas` (CLAUDE.md rule
 * 2). The popup submits nothing and stores nothing (privacy, CLAUDE.md rule 5).
 */
import { useEffect, useState } from "react";
import {
  BADGE_LABELS,
  CHAIN_COPY,
  CONFIDENCE_LABEL_TEXT,
  CREATOR_STATUS_TEXT,
  CORRECTION_CTA,
  EDITORIAL_DISCLAIMER,
  EXPLANATION_TEXT,
  PANEL_COPY,
  POPUP_COPY,
  UNRESEARCHED_SUMMARY,
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
    <main className="cw-dossier">
      <style>{POPUP_STYLE}</style>
      <p className="cw-wordmark">{POPUP_COPY.title}</p>
      <Body state={state} openCorrection={deps.openCorrection} />
    </main>
  );
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
        <section className="cw-card cw-card--enter" data-cw-color="NEUTRAL">
          <div className="cw-verdict">
            <p className="cw-verdict__stamp">{PANEL_COPY.unresearchedHeading}</p>
          </div>
          <p className="cw-summary">{UNRESEARCHED_SUMMARY}</p>
          <p className="cw-disclaimer">{EDITORIAL_DISCLAIMER}</p>
        </section>
      );
    case "researched":
      return (
        <OwnershipDossier
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

/** One node in the vertical ownership-lineage rail (top→bottom, ultimate→channel). */
interface RailNode {
  key: string;
  name: string;
  /** Monospace meta line (mechanism · stake · date); null for the channel base + bare owners. */
  meta: string | null;
  /** Active/dated hops take the verdict accent; undated ones are muted. */
  active: boolean;
  /** Small tag shown under the name ("ultimate owner" / "this channel"). */
  tag: string | null;
  /** The channel node pinned at the base carries the "▶" glyph. */
  isChannel: boolean;
}

/**
 * Build the rail top→bottom. `ownership_chain` is ordered channel→up, so the
 * reversed chain puts the ultimate owner first; the channel is pinned at the
 * base. When no chain is present we still surface any direct owner / ultimate
 * parent as bare (mechanism-free) nodes so no existing data is dropped.
 */
function buildRail(payload: ResearchedChannelLookup): RailNode[] {
  const nodes: RailNode[] = [];
  const chain = payload.ownership_chain ?? [];

  if (chain.length > 0) {
    const topDown = [...chain].reverse();
    topDown.forEach((step, i) => {
      nodes.push({
        key: `chain-${step.name}-${i}`,
        name: step.name,
        meta: chainMetaText(step),
        active: step.effective_from != null && step.effective_from !== "",
        tag: i === 0 ? CHAIN_COPY.ultimateTag : null,
        isChannel: false,
      });
    });
  } else {
    if (payload.ultimate_parent) {
      nodes.push({
        key: "parent",
        name: payload.ultimate_parent.name,
        meta: null,
        active: false,
        tag: CHAIN_COPY.ultimateTag,
        isChannel: false,
      });
    }
    if (payload.direct_owner && payload.direct_owner.name !== payload.ultimate_parent?.name) {
      nodes.push({
        key: "owner",
        name: payload.direct_owner.name,
        meta: null,
        active: false,
        tag: null,
        isChannel: false,
      });
    }
  }

  nodes.push({
    key: "channel",
    name: payload.display_name,
    meta: null,
    active: true,
    tag: CHAIN_COPY.thisChannelTag,
    isChannel: true,
  });
  return nodes;
}

function chainMetaText(step: OwnershipChainStep): string {
  const mechanism = ownershipMechanismText(step.relationship, step.control_level);
  const stake = ownershipStakeText(step.ownership_percentage);
  const date = step.effective_from
    ? `${CHAIN_COPY.effectiveFromPrefix} ${step.effective_from}`
    : "";
  return [mechanism, stake, date].filter(Boolean).join(" · ");
}

function OwnershipDossier({
  payload,
  channelId,
  openCorrection,
}: {
  payload: ResearchedChannelLookup;
  channelId: string;
  openCorrection: (channelId: string) => void;
}) {
  const label: ClassificationLabel = payload.classification.label;
  const color = classificationToBadgeColor(label);
  const rail = buildRail(payload);

  // Compact monospace meta facts: confidence · evidence · creator status.
  const metaFacts = [
    CONFIDENCE_LABEL_TEXT[payload.classification.confidence_label],
    evidenceCountText(payload.evidence_count),
    payload.creator_status ? CREATOR_STATUS_TEXT[payload.creator_status.status] : null,
  ].filter((v): v is string => v != null);

  return (
    <section className="cw-card cw-card--enter" data-cw-color={color}>
      <div className="cw-verdict" aria-label={badgeAriaLabel(label, operativeName(payload))}>
        <p className="cw-verdict__channel">{payload.display_name}</p>
        <p className="cw-verdict__stamp">{BADGE_LABELS[label]}</p>
        <p className="cw-summary">{payload.classification.summary}</p>
      </div>

      <section className="cw-block">
        <p className="cw-eyebrow">{CHAIN_COPY.lineageHeading}</p>
        <ol className="cw-rail">
          {rail.map((node) => (
            <li
              key={node.key}
              className="cw-rail__node"
              data-cw-active={node.active ? "true" : "false"}
              data-cw-channel={node.isChannel ? "true" : undefined}
            >
              <span className="cw-rail__dot" aria-hidden="true" />
              <div className="cw-rail__body">
                <p className="cw-rail__name">
                  {node.isChannel && (
                    <span className="cw-rail__glyph" aria-hidden="true">
                      ▶{" "}
                    </span>
                  )}
                  {node.name}
                </p>
                {node.tag && <span className="cw-rail__tag">{node.tag}</span>}
                {node.meta && <span className="cw-rail__meta">{node.meta}</span>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="cw-meta">{metaFacts.join("  ·  ")}</p>

      {payload.ownership_history && payload.ownership_history.length > 0 && (
        <section className="cw-block">
          <p className="cw-eyebrow">{CHAIN_COPY.historyHeading}</p>
          <ol className="cw-history">
            {payload.ownership_history.map((entry, i) => (
              <HistoryPeriod key={`${entry.name}-${i}`} entry={entry} />
            ))}
          </ol>
        </section>
      )}

      {payload.warnings.length > 0 && (
        <section className="cw-block">
          <p className="cw-eyebrow">{PANEL_COPY.warningsLabel}</p>
          <ul className="cw-notes">
            {payload.warnings.map((code) => (
              <li key={code}>{EXPLANATION_TEXT[code]}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="cw-reviewed">{lastReviewedText(payload.last_reviewed_at)}</p>
      <p className="cw-disclaimer">{EDITORIAL_DISCLAIMER}</p>

      <a
        className="cw-correction"
        href={correctionUrl(channelId)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.preventDefault();
          openCorrection(channelId);
        }}
      >
        {CORRECTION_CTA}
      </a>
    </section>
  );
}

function HistoryPeriod({ entry }: { entry: OwnershipHistoryEntry }) {
  const mechanism = ownershipMechanismText(entry.relationship, entry.control_level);
  const marker = entry.is_current ? CHAIN_COPY.currentLabel : CHAIN_COPY.previouslyPrefix;
  return (
    <li className="cw-history__period" data-cw-current={entry.is_current ? "true" : "false"}>
      <span className="cw-history__name">{entry.name}</span>
      <span className="cw-history__meta">
        {marker} · {mechanism} · {dateRangeText(entry)}
      </span>
    </li>
  );
}

function dateRangeText(entry: OwnershipHistoryEntry): string {
  if (entry.effective_from === null && entry.effective_to === null) {
    return CHAIN_COPY.dateUndisclosed;
  }
  const from = entry.effective_from ?? CHAIN_COPY.dateUndisclosed;
  const to = entry.effective_to ?? (entry.is_current ? CHAIN_COPY.currentLabel : null);
  return to === null ? from : `${from} ${CHAIN_COPY.dateRangeSeparator} ${to}`;
}

const POPUP_STYLE = `
  .cw-dossier {
    --cw-surface: #FBFBFA;
    --cw-ink: #16181B;
    --cw-muted: #5B5F66;
    --cw-hairline: #E6E4DF;
    --cw-accent: #5F6368;
    width: 360px;
    padding: 14px 16px 16px;
    box-sizing: border-box;
    font: 400 13px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: var(--cw-ink);
    background: var(--cw-surface);
  }
  .cw-dossier * { box-sizing: border-box; }

  .cw-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .cw-wordmark {
    margin: 0 0 12px;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--cw-muted);
  }

  .cw-note { margin: 8px 0; color: var(--cw-ink); }

  /* Verdict accent, per §9.2 badge color (foreground-safe both modes). */
  .cw-card[data-cw-color="GREEN"]   { --cw-accent: #1E7E34; }
  .cw-card[data-cw-color="BLUE"]    { --cw-accent: #1565C0; }
  .cw-card[data-cw-color="PURPLE"]  { --cw-accent: #6A1B9A; }
  .cw-card[data-cw-color="ORANGE"]  { --cw-accent: #A85400; }
  .cw-card[data-cw-color="RED"]     { --cw-accent: #B71C1C; }
  .cw-card[data-cw-color="NEUTRAL"] { --cw-accent: #5F6368; }

  .cw-card { margin: 0; }

  /* One restrained fade/slide-in on open (gated by prefers-reduced-motion). */
  @keyframes cw-enter {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .cw-card--enter { animation: cw-enter 260ms ease-out both; }
  @media (prefers-reduced-motion: reduce) {
    .cw-card--enter { animation: none; }
  }

  /* Verdict band: tinted, with a colored left spine in the verdict color. */
  .cw-verdict {
    position: relative;
    padding: 12px 12px 12px 16px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--cw-accent) 12%, transparent);
    overflow: hidden;
  }
  .cw-verdict::before {
    content: "";
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 4px;
    background: var(--cw-accent);
  }
  .cw-verdict__channel {
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.25;
  }
  .cw-verdict__stamp {
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--cw-accent);
  }
  .cw-summary {
    margin: 8px 0 0;
    font-size: 12.5px;
    color: var(--cw-ink);
  }
  .cw-verdict .cw-summary { margin-top: 8px; }

  .cw-block { margin: 16px 0 0; }
  .cw-eyebrow {
    margin: 0 0 8px;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--cw-muted);
  }

  /* Ownership-lineage rail: a vertical spine with a node per hop. */
  .cw-rail { list-style: none; margin: 0; padding: 0; }
  .cw-rail__node {
    position: relative;
    padding: 0 0 14px 20px;
  }
  .cw-rail__node:last-child { padding-bottom: 0; }
  /* The spine (left rule) connecting nodes; drawn behind the dots. */
  .cw-rail__node::before {
    content: "";
    position: absolute;
    left: 4px; top: 4px; bottom: 0;
    width: 2px;
    background: var(--cw-hairline);
  }
  .cw-rail__node:last-child::before { display: none; }
  .cw-rail__node[data-cw-active="true"]::before { background: var(--cw-accent); }
  .cw-rail__dot {
    position: absolute;
    left: 0; top: 3px;
    width: 10px; height: 10px;
    border-radius: 999px;
    background: var(--cw-surface);
    border: 2px solid var(--cw-hairline);
  }
  .cw-rail__node[data-cw-active="true"] > .cw-rail__dot { border-color: var(--cw-accent); }
  .cw-rail__node[data-cw-channel="true"] > .cw-rail__dot { background: var(--cw-accent); border-color: var(--cw-accent); }
  .cw-rail__body { display: block; }
  .cw-rail__name { margin: 0; font-weight: 600; font-size: 13px; line-height: 1.3; }
  .cw-rail__glyph { color: var(--cw-accent); font-size: 10px; }
  .cw-rail__tag {
    display: block;
    margin-top: 1px;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--cw-muted);
  }
  .cw-rail__meta {
    display: block;
    margin-top: 2px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    color: var(--cw-muted);
  }

  /* Compact monospace fact row. */
  .cw-meta {
    margin: 14px 0 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    line-height: 1.6;
    color: var(--cw-muted);
  }

  /* History periods. */
  .cw-history { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .cw-history__period {
    border: 1px solid var(--cw-hairline);
    border-radius: 6px;
    padding: 7px 10px;
    display: grid;
    gap: 2px;
  }
  .cw-history__period[data-cw-current="true"] { border-color: var(--cw-accent); }
  .cw-history__name { font-weight: 600; font-size: 12.5px; }
  .cw-history__meta {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    color: var(--cw-muted);
  }

  .cw-notes { margin: 0; padding-left: 16px; font-size: 12px; color: var(--cw-ink); }
  .cw-notes li { margin: 0 0 3px; }

  .cw-reviewed {
    margin: 16px 0 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10.5px;
    color: var(--cw-muted);
  }
  .cw-disclaimer {
    margin: 6px 0 0;
    font-size: 11px;
    font-style: italic;
    color: var(--cw-muted);
  }

  .cw-correction {
    display: inline-block;
    margin: 12px 0 0;
    color: var(--cw-accent);
    font-weight: 600;
    font-size: 12.5px;
    text-decoration: none;
    border-radius: 4px;
  }
  .cw-correction:hover { text-decoration: underline; }
  .cw-correction:focus-visible {
    outline: 2px solid var(--cw-accent);
    outline-offset: 3px;
  }

  @media (prefers-color-scheme: dark) {
    .cw-dossier {
      --cw-surface: #17181B;
      --cw-ink: #ECEDEE;
      --cw-muted: #9AA0A6;
      --cw-hairline: #2A2C30;
      --cw-accent: #9AA0A6;
    }
    .cw-card[data-cw-color="GREEN"]   { --cw-accent: #4ADE80; }
    .cw-card[data-cw-color="BLUE"]    { --cw-accent: #5AA2F0; }
    .cw-card[data-cw-color="PURPLE"]  { --cw-accent: #C084E8; }
    .cw-card[data-cw-color="ORANGE"]  { --cw-accent: #E0913A; }
    .cw-card[data-cw-color="RED"]     { --cw-accent: #F16A6A; }
    .cw-card[data-cw-color="NEUTRAL"] { --cw-accent: #9AA0A6; }
  }
`;
