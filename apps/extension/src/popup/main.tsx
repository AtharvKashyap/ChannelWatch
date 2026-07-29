import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Popup, type PopupDeps } from "./Popup.js";
import {
  LOOKUP_CHANNEL,
  RESOLVE_CHANNEL,
  type LookupChannelResponse,
  type ResolveChannelResponse,
} from "../shared/messages.js";
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

/**
 * Real chrome-backed dependencies for the popup. `chrome.tabs.query` /
 * `sendMessage` need no `tabs` permission — the youtube host permission is
 * enough to see the tab URL and message the content script. No user data is
 * read from or written to storage.
 */
const deps: PopupDeps = {
  getActiveTabUrl: async () => {
    const tab = await activeTab();
    return tab?.url ?? null;
  },
  resolveChannel: async () => {
    const tab = await activeTab();
    if (tab?.id == null) return null;
    try {
      const response = (await chrome.tabs.sendMessage(tab.id, {
        type: RESOLVE_CHANNEL,
      })) as ResolveChannelResponse | undefined;
      return response?.channelId ?? null;
    } catch {
      // Content script not present / not ready — treat as unresolved.
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
