/**
 * Toolbar popup (SPEC §18.1). Deliberately minimal: it states what the
 * extension does and links to the settings page. It shows NO channel data and
 * makes NO network request — the badge/panel on the page are the ownership
 * surface; the popup is just status + a way into settings.
 */
import { EDITORIAL_DISCLAIMER } from "@channelwatch/schemas";

export function Popup() {
  function openOptions() {
    if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
      void chrome.runtime.openOptionsPage();
    }
  }

  return (
    <main style={{ width: 260, padding: 12, font: '13px/1.5 "Roboto", Arial, sans-serif' }}>
      <h1 style={{ fontSize: 15, margin: "0 0 8px" }}>CHANNELWATCH</h1>
      <p style={{ margin: "0 0 8px" }}>
        Ownership badges appear next to channel names on watch and channel pages. Click a badge to
        see who owns the channel and the sources behind it.
      </p>
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
        Open settings
      </button>
    </main>
  );
}
