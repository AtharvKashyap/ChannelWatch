import { useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  getSettings,
  isValidApiBaseUrl,
  setSettings,
  type BadgeScope,
  type Settings,
} from "../shared/settings.js";

/**
 * Minimal settings page (SPEC §18.2 "Settings Page"). Reads/writes
 * `chrome.storage.sync` via `shared/settings.ts`. Kept deliberately plain —
 * this task is scaffold + background SW only; visual polish is out of scope
 * until the badge/panel work (Tasks 4-5) defines the shared UI language.
 */
export function Options() {
  const [settings, setLocalSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [apiBaseUrlDraft, setApiBaseUrlDraft] = useState(DEFAULT_SETTINGS.apiBaseUrl);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setLocalSettings(s);
        setApiBaseUrlDraft(s.apiBaseUrl);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setLocalSettings(next);
    void setSettings(patch);
  }

  function updateApiBaseUrlDraft(value: string) {
    setApiBaseUrlDraft(value);
    // Only persist once it parses as a proper http(s) origin — junk stays in
    // the input's local draft state instead of being written to
    // chrome.storage.sync (and then handed to the background SW's fetch).
    if (isValidApiBaseUrl(value)) update({ apiBaseUrl: value });
  }

  const apiBaseUrlIsValid = isValidApiBaseUrl(apiBaseUrlDraft);

  if (!loaded) return <p>Loading settings…</p>;

  return (
    <main>
      <h1>CHANNELWATCH Settings</h1>

      <label>
        Badge scope:
        <select
          value={settings.badgeScope}
          onChange={(e) => update({ badgeScope: e.target.value as BadgeScope })}
        >
          <option value="everywhere">Everywhere</option>
          <option value="watch_and_channel_only">Watch + channel pages only</option>
        </select>
      </label>

      <label>
        <input
          type="checkbox"
          checked={settings.hideCreatorOwnedBadges}
          onChange={(e) => update({ hideCreatorOwnedBadges: e.target.checked })}
        />
        Hide badges for creator-owned channels
      </label>

      <label>
        <input
          type="checkbox"
          checked={settings.onlyConfirmed}
          onChange={(e) => update({ onlyConfirmed: e.target.checked })}
        />
        Only show confirmed-confidence records
      </label>

      <label>
        API base URL (dev):
        <input
          type="text"
          value={apiBaseUrlDraft}
          aria-invalid={!apiBaseUrlIsValid}
          onChange={(e) => updateApiBaseUrlDraft(e.target.value)}
        />
      </label>
      {!apiBaseUrlIsValid && (
        <p role="alert">
          Must be a plain http:// or https:// origin (no path, query, or fragment).
        </p>
      )}
    </main>
  );
}
