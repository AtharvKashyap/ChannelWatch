/**
 * Build-time configuration. NOT user data — nothing here is read from or written
 * to `chrome.storage`, and the extension persists no user data at all (see
 * PRIVACY.md). Both values are baked into the bundle at build time from Vite env
 * vars; there is no settings page and no runtime override.
 */

/**
 * The API origin the background service worker fetches ownership lookups from.
 * MUST track the same `VITE_API_BASE_URL` that `manifest.config.ts` uses to
 * derive `host_permissions` — otherwise the bundle could be granted host access
 * for the prod origin while still fetching localhost. Falls back to the local
 * API dev server when unset (a store build MUST set it — see
 * docs/reproducible-build.md).
 */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8787";

/**
 * The public website origin, used only to build the "Report an error"
 * correction LINK the popup opens in a new tab (`/corrections?channel=UC…`).
 * This is a user-initiated navigation, not a fetch, so it needs no host
 * permission. Baked from `VITE_WEB_BASE_URL`; defaults to the local web dev
 * server.
 */
export const WEB_BASE_URL: string =
  (import.meta.env.VITE_WEB_BASE_URL as string | undefined) ?? "http://localhost:3000";

/** URL of the public correction form, prefilled with the channel under review. */
export function correctionUrl(channelId: string): string {
  const base = WEB_BASE_URL.replace(/\/+$/, "");
  return `${base}/corrections?channel=${encodeURIComponent(channelId)}`;
}
