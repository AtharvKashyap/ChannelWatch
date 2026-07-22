/**
 * Extension settings (SPEC §18.2 "Settings Page"), persisted to
 * `chrome.storage.sync` so they follow the user across signed-in browser
 * instances. Distinct from the per-channel lookup cache, which lives in
 * `chrome.storage.local` (see `background/cache.ts`) and is never synced.
 */

/** Where the badge is shown: everywhere YouTube renders a channel, or only on
 * the watch page + the channel's own page. */
export type BadgeScope = "everywhere" | "watch_and_channel_only";

export interface Settings {
  badgeScope: BadgeScope;
  /** Hide the badge for channels that are creator-owned (nothing to flag). */
  hideCreatorOwnedBadges: boolean;
  /** Only show badges for CONFIRMED-confidence records; suppress the rest. */
  onlyConfirmed: boolean;
  /** API base URL (dev-configurable; defaults to the local API dev server). */
  apiBaseUrl: string;
}

/**
 * Default API base URL. MUST track the same `VITE_API_BASE_URL` env var that
 * `manifest.config.ts` uses to derive `host_permissions` — otherwise a
 * production build could grant host permission for the prod API origin while
 * still defaulting to fetching `localhost` (a real functional bug, not just a
 * dev inconvenience). Falls back to the local API dev server when unset.
 */
const DEFAULT_API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8787";

export const DEFAULT_SETTINGS: Settings = {
  badgeScope: "everywhere",
  hideCreatorOwnedBadges: false,
  onlyConfirmed: false,
  apiBaseUrl: DEFAULT_API_BASE_URL,
};

/** Reads settings from `chrome.storage.sync`, filling in any unset keys with defaults. */
export async function getSettings(): Promise<Settings> {
  const stored = (await chrome.storage.sync.get(DEFAULT_SETTINGS)) as Partial<Settings>;
  return { ...DEFAULT_SETTINGS, ...stored };
}

/** Persists a partial settings patch to `chrome.storage.sync`. */
export async function setSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.sync.set(patch);
}

/**
 * True iff `value` parses as an `http:`/`https:` origin (host, optionally a
 * port; no path/query/fragment) — the shape `apiBaseUrl` is used in, since
 * `api-client.ts` appends `/api/v1/...` to it. Used by the options page to
 * reject junk before it is persisted to `chrome.storage.sync`.
 */
export function isValidApiBaseUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.pathname !== "/" && url.pathname !== "") return false;
  if (url.search !== "" || url.hash !== "") return false;
  return true;
}
