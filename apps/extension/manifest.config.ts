import { defineManifest } from "@crxjs/vite-plugin";

/**
 * The API origin the extension is allowed to talk to (§18.7 "keep permissions
 * minimal"). Configurable for local dev via VITE_API_BASE_URL; defaults to the
 * local API dev server. Only this origin + youtube.com are ever requested.
 */
const API_ORIGIN = process.env.VITE_API_BASE_URL ?? "http://localhost:8787";

/**
 * MV3 manifest (SPEC §18.7). Permissions are kept to the documented minimum:
 * `storage` (local cache + sync settings) plus host permissions for youtube.com
 * (content script matches) and the API origin (background fetches). NOTHING
 * else — no `tabs`, no `cookies`, no `identity`, no broad host access.
 */
export default defineManifest({
  manifest_version: 3,
  name: "CHANNELWATCH",
  version: "0.0.0",
  description:
    "Shows who owns, finances, or commercially influences a YouTube channel, with sourced evidence.",
  permissions: ["storage"],
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
  options_page: "src/options/index.html",
  action: {
    default_title: "CHANNELWATCH",
    default_popup: "src/popup/index.html",
  },
});
