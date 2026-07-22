import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "../mocks/chrome.js";
import {
  DEFAULT_SETTINGS,
  getSettings,
  isValidApiBaseUrl,
  setSettings,
} from "../../src/shared/settings.js";

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

describe("isValidApiBaseUrl", () => {
  it.each(["http://localhost:8787", "https://api.channelwatch.example"])(
    "accepts a plain http(s) origin: %s",
    (value) => {
      expect(isValidApiBaseUrl(value)).toBe(true);
    },
  );

  it.each([
    "not a url",
    "ftp://example.com",
    "https://api.example.com/api/v1",
    "https://api.example.com?x=1",
    "https://api.example.com#frag",
  ])("rejects %s", (value) => {
    expect(isValidApiBaseUrl(value)).toBe(false);
  });
});

describe("DEFAULT_SETTINGS.apiBaseUrl tracks VITE_API_BASE_URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the local API dev server when VITE_API_BASE_URL is unset", async () => {
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    vi.resetModules();

    const mod = await import("../../src/shared/settings.js");
    expect(mod.DEFAULT_SETTINGS.apiBaseUrl).toBe("http://localhost:8787");
  });

  it("uses VITE_API_BASE_URL as the default when set — the SAME env var manifest.config.ts reads for host_permissions", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.channelwatch.example");
    vi.resetModules();

    const mod = await import("../../src/shared/settings.js");
    expect(mod.DEFAULT_SETTINGS.apiBaseUrl).toBe("https://api.channelwatch.example");
  });
});
