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

export const DEFAULT_SETTINGS: Settings = {
  badgeScope: "everywhere",
  hideCreatorOwnedBadges: false,
  onlyConfirmed: false,
  apiBaseUrl: "http://localhost:8787",
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
