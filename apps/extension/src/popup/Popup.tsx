/**
 * Toolbar popup — the extension's ONLY user interface (the M3 redesign removed
 * all page injection). On open it determines whether the active tab is a
 * YouTube WATCH page; if so it resolves the currently-playing video's channel
 * (via the minimal content script) and looks up its ownership record (via the
 * background SW), then renders the ownership box. On the homepage / channel
 * pages / non-YouTube tabs it shows a friendly prompt.
 *
 * Every user-facing string comes from `@channelwatch/schemas` (CLAUDE.md rule
 * 2). The standing editorial disclaimer is shown verbatim. The "Report an
 * error" affordance is a LINK to the public correction form — the popup submits
 * nothing and stores nothing (privacy, CLAUDE.md rule 5).
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
  classificationToBadgeColor,
  evidenceCountText,
  lastReviewedText,
  ownershipMechanismText,
  ownershipStakeText,
  type BadgeColor,
  type OwnershipChainStep,
  type OwnershipHistoryEntry,
  type ResearchedChannelLookup,
} from "@channelwatch/schemas";
import type { LookupChannelResponse } from "../shared/messages.js";
import { correctionUrl } from "../shared/config.js";

/** Accessible badge palette (mirrors the former panel's §9.2 colors). */
const BADGE_PALETTE: Record<BadgeColor, string> = {
  NEUTRAL: "#5f6368",
  GREEN: "#1e7e34",
  BLUE: "#1565c0",
  PURPLE: "#6a1b9a",
  ORANGE: "#a85400",
  RED: "#b71c1c",
};

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
    <main className="cw-popup">
      <style>{POPUP_STYLE}</style>
      <h1 className="cw-popup__title">{POPUP_COPY.title}</h1>
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
        <p role="status" className="cw-popup__msg">
          {state.slow ? POPUP_COPY.slowLoading : POPUP_COPY.loading}
        </p>
      );
    case "not_watch":
      return <p className="cw-popup__msg">{POPUP_COPY.notWatchPage}</p>;
    case "unresolved":
      return <p className="cw-popup__msg">{POPUP_COPY.channelUnresolved}</p>;
    case "error":
      return (
        <p role="alert" className="cw-popup__msg">
          {POPUP_COPY.lookupError}
        </p>
      );
    case "unresearched":
      return (
        <div className="cw-popup__box">
          <p className="cw-popup__label" data-cw-color="NEUTRAL" style={{ background: BADGE_PALETTE.NEUTRAL }}>
            {PANEL_COPY.unresearchedHeading}
          </p>
          <p className="cw-popup__summary">{UNRESEARCHED_SUMMARY}</p>
          <p className="cw-popup__disclaimer">{EDITORIAL_DISCLAIMER}</p>
        </div>
      );
    case "researched":
      return (
        <OwnershipBox payload={state.payload} channelId={state.channelId} openCorrection={openCorrection} />
      );
  }
}

function OwnershipBox({
  payload,
  channelId,
  openCorrection,
}: {
  payload: ResearchedChannelLookup;
  channelId: string;
  openCorrection: (channelId: string) => void;
}) {
  const label = payload.classification.label;
  const color = classificationToBadgeColor(label);

  return (
    <div className="cw-popup__box">
      <p className="cw-popup__channel">{payload.display_name}</p>
      <p className="cw-popup__label" data-cw-color={color} style={{ background: BADGE_PALETTE[color] }}>
        {BADGE_LABELS[label]}
      </p>
      <p className="cw-popup__summary">{payload.classification.summary}</p>

      <dl className="cw-popup__facts">
        {payload.direct_owner && (
          <Fact term={PANEL_COPY.directOwnerLabel} value={payload.direct_owner.name} />
        )}
        {payload.ultimate_parent && (
          <Fact term={PANEL_COPY.ultimateParentLabel} value={payload.ultimate_parent.name} />
        )}
        {payload.creator_status && (
          <Fact
            term={PANEL_COPY.creatorStatusLabel}
            value={CREATOR_STATUS_TEXT[payload.creator_status.status]}
          />
        )}
        <Fact
          term={PANEL_COPY.confidenceLabel}
          value={CONFIDENCE_LABEL_TEXT[payload.classification.confidence_label]}
        />
        <Fact term={PANEL_COPY.evidenceLabel} value={evidenceCountText(payload.evidence_count)} />
      </dl>

      {payload.ownership_chain && payload.ownership_chain.length > 0 && (
        <section className="cw-popup__section">
          <h2>{CHAIN_COPY.heading}</h2>
          <ol className="cw-popup__list">
            {payload.ownership_chain.map((step, i) => (
              <ChainHop key={`${step.name}-${i}`} step={step} />
            ))}
          </ol>
        </section>
      )}

      {payload.ownership_history && payload.ownership_history.length > 0 && (
        <section className="cw-popup__section">
          <h2>{CHAIN_COPY.historyHeading}</h2>
          <ol className="cw-popup__list">
            {payload.ownership_history.map((entry, i) => (
              <HistoryPeriod key={`${entry.name}-${i}`} entry={entry} />
            ))}
          </ol>
        </section>
      )}

      {payload.warnings.length > 0 && (
        <section className="cw-popup__section">
          <h2>{PANEL_COPY.warningsLabel}</h2>
          <ul className="cw-popup__notes">
            {payload.warnings.map((code) => (
              <li key={code}>{EXPLANATION_TEXT[code]}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="cw-popup__reviewed">{lastReviewedText(payload.last_reviewed_at)}</p>
      <p className="cw-popup__disclaimer">{EDITORIAL_DISCLAIMER}</p>

      <a
        className="cw-popup__correction"
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
    </div>
  );
}

function ChainHop({ step }: { step: OwnershipChainStep }) {
  const mechanism = ownershipMechanismText(step.relationship, step.control_level);
  const stake = ownershipStakeText(step.ownership_percentage);
  return (
    <li>
      <span className="cw-popup__name">{step.name}</span>
      <span className="cw-popup__meta">
        {mechanism} · {stake}
        {step.effective_from ? ` · ${CHAIN_COPY.effectiveFromPrefix} ${step.effective_from}` : ""}
      </span>
    </li>
  );
}

function HistoryPeriod({ entry }: { entry: OwnershipHistoryEntry }) {
  const mechanism = ownershipMechanismText(entry.relationship, entry.control_level);
  const marker = entry.is_current ? CHAIN_COPY.currentLabel : CHAIN_COPY.previouslyPrefix;
  return (
    <li>
      <span className="cw-popup__name">{entry.name}</span>
      <span className="cw-popup__meta">
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

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="cw-fact">
      <dt>{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}

const POPUP_STYLE = `
  .cw-popup {
    width: 320px;
    padding: 14px 16px;
    font: 400 13px/1.5 "Roboto", "Arial", sans-serif;
    color: #0f0f0f;
    background: #ffffff;
    box-sizing: border-box;
  }
  .cw-popup * { box-sizing: border-box; }
  .cw-popup__title { margin: 0 0 8px; font-size: 14px; font-weight: 700; letter-spacing: 0.04em; }
  .cw-popup__msg { margin: 8px 0; }
  .cw-popup__channel { margin: 0 0 6px; font-weight: 600; font-size: 14px; }
  .cw-popup__label {
    display: inline-block; margin: 0 0 8px; padding: 3px 10px;
    border-radius: 999px; color: #fff; font-weight: 600; font-size: 12px;
  }
  .cw-popup__summary { margin: 4px 0 12px; }
  .cw-popup__facts { margin: 0 0 12px; display: grid; gap: 6px; }
  .cw-fact dt { font-weight: 600; font-size: 11px; text-transform: uppercase; opacity: 0.7; }
  .cw-fact dd { margin: 0; }
  .cw-popup__section h2 { margin: 12px 0 6px; font-size: 13px; font-weight: 600; }
  .cw-popup__list { margin: 0 0 12px; padding-left: 18px; display: grid; gap: 6px; }
  .cw-popup__name { display: block; font-weight: 600; }
  .cw-popup__meta { display: block; font-size: 11px; opacity: 0.8; }
  .cw-popup__notes { margin: 0 0 12px; padding-left: 18px; }
  .cw-popup__reviewed { font-size: 11px; opacity: 0.7; margin: 4px 0; }
  .cw-popup__disclaimer { font-size: 11px; font-style: italic; opacity: 0.8; margin: 4px 0 10px; }
  .cw-popup__correction {
    display: inline-block; color: #065fd4; font-weight: 600; text-decoration: none;
  }
  .cw-popup__correction:hover { text-decoration: underline; }
  @media (prefers-color-scheme: dark) {
    .cw-popup { background: #212121; color: #f1f1f1; }
    .cw-popup__correction { color: #5a9bff; }
  }
`;
