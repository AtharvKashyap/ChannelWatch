import { defineManifest } from "@crxjs/vite-plugin";

/**
 * The API origin the extension is allowed to talk to (§18.7 "keep permissions
 * minimal"). Configurable for local dev via VITE_API_BASE_URL; defaults to the
 * local API dev server. Only this origin + youtube.com are ever requested.
 */
const API_ORIGIN = process.env.VITE_API_BASE_URL ?? "http://localhost:8787";

/**
 * MV3 manifest (SPEC §18.7). Permissions are kept to the documented minimum:
 *   - `scripting`: the ONLY API permission. It lets the popup inject a one-shot
 *     channel-ID reader into the active YouTube watch tab via
 *     `chrome.scripting.executeScript` WHEN THE USER OPENS THE POPUP — replacing
 *     the always-on content script. This "runs only on click" model is a privacy
 *     improvement (no persistent page presence) and also fixes the reliability
 *     bug where tabs opened before install/reload had no content script to
 *     answer, hanging the popup until a manual reload. `scripting` acts only on
 *     hosts already covered by `host_permissions`.
 *   - no `storage`: the extension persists no user data (the lookup cache is an
 *     in-memory Map in the service worker; there is no settings page);
 *   - no `tabs`: `chrome.tabs.query`/`create` work under the youtube host
 *     permission without it;
 *   - no `cookies`, `identity`, or broad host access.
 * Only two host-permission patterns: youtube.com (where the popup injects the
 * one-shot resolver — `scripting` needs this host permission) and the API origin
 * (background lookups). There is NO declared `content_scripts` block: nothing is
 * injected until the user clicks the toolbar icon.
 */
export default defineManifest({
  manifest_version: 3,
  name: "CHANNELWATCH",
  version: "0.1.0",
  description:
    "Shows who owns, finances, or commercially influences a YouTube channel, with sourced evidence.",
  permissions: ["scripting"],
  host_permissions: ["https://www.youtube.com/*", `${API_ORIGIN}/*`],
  icons: {
    "16": "icon-16.png",
    "32": "icon-32.png",
    "48": "icon-48.png",
    "128": "icon-128.png",
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  action: {
    default_title: "CHANNELWATCH",
    default_popup: "src/popup/index.html",
    default_icon: {
      "16": "icon-16.png",
      "32": "icon-32.png",
      "48": "icon-48.png",
      "128": "icon-128.png",
    },
  },
});
