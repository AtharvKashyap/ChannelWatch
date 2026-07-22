/**
 * Toolbar popup (SPEC §18.1). Deliberately minimal: it states what the
 * extension does and links to the settings page. It shows NO channel data and
 * makes NO network request — the badge/panel on the page are the ownership
 * surface; the popup is just status + a way into settings.
 */
import { EDITORIAL_DISCLAIMER, POPUP_COPY } from "@channelwatch/schemas";

export function Popup() {
  function openOptions() {
    if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
      void chrome.runtime.openOptionsPage();
    }
  }

  return (
    <main style={{ width: 260, padding: 12, font: '13px/1.5 "Roboto", Arial, sans-serif' }}>
      <h1 style={{ fontSize: 15, margin: "0 0 8px" }}>{POPUP_COPY.title}</h1>
      <p style={{ margin: "0 0 8px" }}>{POPUP_COPY.description}</p>
      <p style={{ fontSize: 11, fontStyle: "italic", opacity: 0.8, margin: "0 0 12px" }}>
        {EDITORIAL_DISCLAIMER}
      </p>
      <button
        type="button"
        onClick={openOptions}
        style={{
          padding: "8px 14px",
          border: 0,
          borderRadius: 8,
          background: "#065fd4",
          color: "#fff",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {POPUP_COPY.openSettings}
      </button>
    </main>
  );
}
