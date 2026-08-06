import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Popup, type PopupDeps } from "./Popup.js";
import { LOOKUP_CHANNEL, type LookupChannelResponse } from "../shared/messages.js";
import { resolveChannelIdInPage } from "../content/inject-resolver.js";
import { correctionUrl } from "../shared/config.js";

/** The active tab in the current window (or null if none). */
async function activeTab(): Promise<chrome.tabs.Tab | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ?? null;
  } catch {
    return null;
  }
}

/** Watch pages only (CLAUDE.md constraint): `/watch`, `/shorts/…`, `/live/…`. */
function isYouTubeWatchUrl(url: string | null | undefined): boolean {
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

/**
 * Real chrome-backed dependencies for the popup. `chrome.tabs.query` / `create`
 * need no `tabs` permission — the youtube host permission is enough to see the
 * tab URL and open the correction tab. Channel resolution runs a one-shot
 * injected reader via `chrome.scripting.executeScript` (the `scripting`
 * permission) — no persistent content script, so it works on ANY tab with no
 * reload, and the extension touches the page ONLY when the popup is open. No
 * user data is read from or written to storage.
 */
const deps: PopupDeps = {
  getActiveTabUrl: async () => {
    const tab = await activeTab();
    return tab?.url ?? null;
  },
  resolveChannel: async () => {
    const tab = await activeTab();
    if (tab?.id == null) return null;
    // Guard: only inject into a YouTube watch tab. `executeScript` would reject
    // on restricted pages (chrome://, the Web Store) and waste an injection
    // elsewhere; the injected resolver also returns null off watch pages.
    if (!isYouTubeWatchUrl(tab.url)) return null;
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: resolveChannelIdInPage,
      });
      const result = results[0]?.result;
      return typeof result === "string" ? result : null;
    } catch {
      // Injection blocked (restricted page / missing host permission) or the
      // resolver threw — treat as unresolved. Never hang the popup.
      return null;
    }
  },
  lookup: async (channelId: string): Promise<LookupChannelResponse> => {
    try {
      return (await chrome.runtime.sendMessage({
        type: LOOKUP_CHANNEL,
        channelId,
      })) as LookupChannelResponse;
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Message failed" };
    }
  },
  openCorrection: (channelId: string) => {
    try {
      void chrome.tabs.create({ url: correctionUrl(channelId) });
    } catch {
      /* fail-silent */
    }
  },
};

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <Popup deps={deps} />
    </StrictMode>,
  );
}
