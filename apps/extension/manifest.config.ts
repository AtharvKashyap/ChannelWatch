import { defineManifest } from "@crxjs/vite-plugin";

/**
 * The API origin the extension is allowed to talk to (§18.7 "keep permissions
 * minimal"). Configurable for local dev via VITE_API_BASE_URL; defaults to the
 * local API dev server. Only this origin + youtube.com are ever requested.
 */
const API_ORIGIN = process.env.VITE_API_BASE_URL ?? "http://localhost:8787";

/**
 * MV3 manifest (SPEC §18.7). Permissions are kept to the documented minimum —
 * in the popup-only redesign that means NO API permissions at all:
 *   - no `storage`: the extension persists no user data (the lookup cache is an
 *     in-memory Map in the service worker; there is no settings page);
 *   - no `tabs`: `chrome.tabs.query`/`sendMessage`/`create` work under the
 *     youtube host permission without it;
 *   - no `scripting`, `cookies`, `identity`, or broad host access.
 * Only two host-permission patterns: youtube.com (the minimal content script
 * that resolves the channel id) and the API origin (background lookups).
 */
export default defineManifest({
  manifest_version: 3,
  name: "CHANNELWATCH",
  version: "0.1.0",
  description:
    "Shows who owns, finances, or commercially influences a YouTube channel, with sourced evidence.",
  host_permissions: ["https://www.youtube.com/*", `${API_ORIGIN}/*`],
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["https://www.youtube.com/*"],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
  action: {
    default_title: "CHANNELWATCH",
    default_popup: "src/popup/index.html",
  },
});
