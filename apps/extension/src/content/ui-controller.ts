/**
 * Ties the content pipeline to the UI: subscribes to `onChannelResolved`, and
 * for each resolution renders (or clears) the badge, wiring a badge click to the
 * ownership panel. Dependency-injected so it can be unit-tested against a fake
 * document/subscription without a live extension context; `mountUi()` (below)
 * supplies the real dependencies.
 *
 * Fail-silent: a render is wrapped so a failure logs at debug and never throws
 * into the page.
 */
import { removeBadge, renderBadge } from "./badge-renderer.js";
import { openPanel as openPanelReal, closePanel as closePanelReal } from "./panel-host.js";
import { onChannelResolved, getLastResolved, type ChannelResolved } from "./index.js";
import { getSettings, type Settings } from "../shared/settings.js";
import { SUBMIT_CORRECTION, type SubmitCorrectionResponse } from "../shared/messages.js";
import type { CorrectionSubmission, ResearchedChannelLookup } from "@channelwatch/schemas";

export interface UiDeps {
  doc: Document;
  getUrl: () => string;
  getSettings: () => Promise<Settings>;
  subscribe: (cb: (r: ChannelResolved) => void) => () => void;
  getLast: () => ChannelResolved | null;
  openPanel: (payload: ResearchedChannelLookup) => void;
  closePanel: () => void;
}

/** Start the UI controller. Returns a teardown that unsubscribes and clears UI. */
export function startUi(deps: UiDeps): () => void {
  let stopped = false;
  let latest: ChannelResolved | null = deps.getLast();

  async function render(): Promise<void> {
    if (stopped) return;
    try {
      const current = latest;
      // Any new resolution invalidates an open panel — it described the PREVIOUS
      // channel, and the pipeline only re-notifies on an actual channel change.
      // Close it (safer than hot-swapping content mid-read) before we (re)render
      // the badge for the current channel.
      deps.closePanel();
      if (!current || current.channelId === null) {
        removeBadge(deps.doc);
        return;
      }
      const settings = await deps.getSettings();
      if (stopped) return;
      renderBadge({
        doc: deps.doc,
        url: deps.getUrl(),
        response: current.response,
        settings,
        onActivate: deps.openPanel,
      });
    } catch (err) {
      console.debug("[channelwatch] UI render failed", err);
    }
  }

  const unsubscribe = deps.subscribe((r) => {
    latest = r;
    void render();
  });

  // Handle a resolution that already happened before we subscribed.
  void render();

  return () => {
    stopped = true;
    unsubscribe();
    removeBadge(deps.doc);
    deps.closePanel();
  };
}

/**
 * Submit a correction by messaging the background SW (`SUBMIT_CORRECTION`). The
 * panel form never `fetch`es directly — routing through the SW avoids
 * content-script CORS limits and keeps the API origin in one place.
 */
async function submitCorrectionViaSw(
  submission: CorrectionSubmission,
): Promise<SubmitCorrectionResponse> {
  try {
    return (await chrome.runtime.sendMessage({
      type: SUBMIT_CORRECTION,
      submission,
    })) as SubmitCorrectionResponse;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Message failed" };
  }
}

/** Wire the controller with real dependencies. Called once from the content entry. */
export function mountUi(): () => void {
  return startUi({
    doc: document,
    getUrl: () => document.URL,
    getSettings,
    subscribe: onChannelResolved,
    getLast: getLastResolved,
    openPanel: (payload) => openPanelReal(document, payload, submitCorrectionViaSw),
    closePanel: () => closePanelReal(document),
  });
}
