import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../mocks/chrome.js";
import { DEFAULT_SETTINGS, getSettings, setSettings } from "../../src/shared/settings.js";

beforeEach(() => {
  installChromeMock();
});

describe("settings store (chrome.storage.sync)", () => {
  it("returns defaults when nothing is stored", async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("persists and merges a partial patch over the defaults", async () => {
    await setSettings({ onlyConfirmed: true, apiBaseUrl: "https://api.example.test" });

    const settings = await getSettings();
    expect(settings).toEqual({
      ...DEFAULT_SETTINGS,
      onlyConfirmed: true,
      apiBaseUrl: "https://api.example.test",
    });
  });
});
