/**
 * Mounts/unmounts the React `OwnershipPanel` inside a Shadow DOM host appended
 * to the page. The shadow root isolates the panel's styles from YouTube's (and
 * vice versa). A stable host id guarantees a single panel — opening again
 * replaces the previous one.
 */
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { OwnershipPanel } from "./ownership-panel.js";
import { FailSilentBoundary } from "./error-boundary.js";
import type { CorrectionSubmission, ResearchedChannelLookup } from "@channelwatch/schemas";
import type { SubmitCorrectionResponse } from "../shared/messages.js";

export const PANEL_HOST_ID = "channelwatch-panel-host";

const PANEL_STYLE = `
  :host { all: initial; }
  .cw-panel {
    position: fixed;
    top: 64px;
    right: 16px;
    z-index: 2147483647;
    width: 340px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 96px);
    overflow-y: auto;
    padding: 16px;
    border-radius: 12px;
    background: #ffffff;
    color: #0f0f0f;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
    font: 400 13px/1.5 "Roboto", "Arial", sans-serif;
    box-sizing: border-box;
  }
  .cw-panel * { box-sizing: border-box; }
  .cw-panel__head { display: flex; align-items: center; justify-content: space-between; }
  .cw-panel__title { margin: 0; font-size: 15px; font-weight: 600; }
  .cw-panel__close {
    border: 0; background: transparent; font-size: 20px; line-height: 1;
    cursor: pointer; color: inherit; padding: 4px;
  }
  .cw-panel__label {
    display: inline-block; margin: 8px 0 4px; padding: 2px 8px;
    border-radius: 999px; color: #fff; font-weight: 600; font-size: 12px;
  }
  .cw-panel__label[data-cw-color="NEUTRAL"] { background: #5f6368; }
  .cw-panel__label[data-cw-color="GREEN"] { background: #1e7e34; }
  .cw-panel__label[data-cw-color="BLUE"] { background: #1565c0; }
  .cw-panel__label[data-cw-color="PURPLE"] { background: #6a1b9a; }
  .cw-panel__label[data-cw-color="ORANGE"] { background: #a85400; }
  .cw-panel__label[data-cw-color="RED"] { background: #b71c1c; }
  .cw-panel__summary { margin: 4px 0 12px; }
  .cw-panel__facts { margin: 0 0 12px; display: grid; gap: 6px; }
  .cw-fact { display: grid; grid-template-columns: 1fr; }
  .cw-fact dt { font-weight: 600; font-size: 11px; text-transform: uppercase; opacity: 0.7; }
  .cw-fact dd { margin: 0; }
  .cw-panel__chain h3, .cw-panel__history h3, .cw-panel__warnings h3, .cw-panel__correction h3 { margin: 12px 0 6px; font-size: 13px; }
  .cw-chain, .cw-history { margin: 0 0 12px; padding-left: 18px; display: grid; gap: 6px; }
  .cw-chain__hop { }
  .cw-chain__name, .cw-history__name { display: block; font-weight: 600; }
  .cw-chain__meta, .cw-history__meta { display: block; font-size: 11px; opacity: 0.8; }
  .cw-panel__warnings ul { margin: 0; padding-left: 18px; }
  .cw-panel__reviewed { font-size: 11px; opacity: 0.7; margin: 4px 0; }
  .cw-panel__disclaimer { font-size: 11px; font-style: italic; opacity: 0.8; margin: 4px 0 8px; }
  .cw-panel__correction { border-top: 1px solid #e0e0e0; padding-top: 8px; }
  .cw-panel__correction label { display: block; margin-bottom: 8px; font-size: 12px; }
  .cw-panel__correction textarea,
  .cw-panel__correction input {
    display: block; width: 100%; margin-top: 4px; padding: 6px;
    border: 1px solid #ccc; border-radius: 6px; font: inherit;
  }
  .cw-panel__correction button {
    padding: 8px 14px; border: 0; border-radius: 8px;
    background: #065fd4; color: #fff; font-weight: 600; cursor: pointer;
  }
  .cw-panel__correction button:disabled { opacity: 0.6; cursor: default; }
  .cw-panel__error { color: #b71c1c; font-size: 12px; }
  .cw-panel__receipt { color: #1e7e34; }
  @media (prefers-color-scheme: dark) {
    .cw-panel { background: #212121; color: #f1f1f1; }
    .cw-panel__correction { border-top-color: #3f3f3f; }
    .cw-panel__correction textarea, .cw-panel__correction input {
      background: #121212; color: #f1f1f1; border-color: #555;
    }
  }
`;

let activeRoot: Root | null = null;

/** Open (or replace) the ownership panel for `payload`. Never throws. */
export function openPanel(
  doc: Document,
  payload: ResearchedChannelLookup,
  onSubmitCorrection: (submission: CorrectionSubmission) => Promise<SubmitCorrectionResponse>,
): void {
  try {
    closePanel(doc);

    const host = doc.createElement("div");
    host.id = PANEL_HOST_ID;
    const shadow = host.attachShadow({ mode: "open" });

    const style = doc.createElement("style");
    style.textContent = PANEL_STYLE;
    shadow.appendChild(style);

    const mountPoint = doc.createElement("div");
    shadow.appendChild(mountPoint);
    doc.body.appendChild(host);

    activeRoot = createRoot(mountPoint);
    activeRoot.render(
      createElement(
        FailSilentBoundary,
        null,
        createElement(OwnershipPanel, {
          payload,
          onClose: () => closePanel(doc),
          onSubmitCorrection,
        }),
      ),
    );
  } catch (err) {
    console.debug("[channelwatch] openPanel failed", err);
  }
}

/** Close the panel if open. Safe to call when nothing is open. */
export function closePanel(doc: Document): void {
  try {
    if (activeRoot) {
      activeRoot.unmount();
      activeRoot = null;
    }
    for (const el of doc.querySelectorAll(`#${PANEL_HOST_ID}`)) el.remove();
  } catch (err) {
    console.debug("[channelwatch] closePanel failed", err);
  }
}
