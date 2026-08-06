import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveChannelIdInPage } from "../../src/content/inject-resolver.js";

/**
 * Canary for the self-contained, INJECTED channel resolver (the function
 * `chrome.scripting.executeScript` serializes into the page when the popup
 * opens). It reads `document`/`document.URL` by default in the page; here we
 * pass a parsed snapshot document + its URL explicitly so the same code is
 * exercised without a real browser.
 *
 * The first case is the selector-health canary: it must keep proving that a
 * real, sanitized watch-page snapshot yields the correct immutable `UC…` id.
 */
const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(here, "..", "fixtures", name), "utf-8");
const parse = (html: string): Document => new DOMParser().parseFromString(html, "text/html");

const VERITASIUM = "UCHnyfMqiRRG1u-2MsSQLbXA";

describe("resolveChannelIdInPage — injected watch-page resolver", () => {
  it("resolves the video's channel ID from the real watch-page snapshot (canary)", () => {
    const doc = parse(fixture("watch-page.html"));
    expect(resolveChannelIdInPage(doc, "https://www.youtube.com/watch?v=AF8d72mA41M")).toBe(
      VERITASIUM,
    );
  });

  it("returns null on a channel page (watch-only scope, deliberately disabled)", () => {
    const doc = parse(fixture("channel-page.html"));
    // The channel-page snapshot DOES carry a resolvable UC id, but the injected
    // resolver is scoped to watch pages only — so it must report nothing here.
    expect(resolveChannelIdInPage(doc, "https://www.youtube.com/@veritasium")).toBeNull();
  });

  it("returns null on the homepage", () => {
    const doc = parse("<html><body></body></html>");
    expect(resolveChannelIdInPage(doc, "https://www.youtube.com/")).toBeNull();
  });

  it("resolves a /shorts/ watch page from a fresh player-response script", () => {
    const doc = parse(
      `<html><body><script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"SHORT1","channelId":"${VERITASIUM}"}};</script></body></html>`,
    );
    expect(resolveChannelIdInPage(doc, "https://www.youtube.com/shorts/SHORT1")).toBe(VERITASIUM);
  });

  it("falls back to a rendered owner anchor href (/channel/UC…)", () => {
    const doc = parse(
      `<html><body><ytd-video-owner-renderer><a href="/channel/${VERITASIUM}">Veritasium</a></ytd-video-owner-renderer></body></html>`,
    );
    expect(resolveChannelIdInPage(doc, "https://www.youtube.com/watch?v=x")).toBe(VERITASIUM);
  });

  it("NEVER resolves by display name alone", () => {
    const doc = parse(
      `<html><body><ytd-video-owner-renderer><a>Veritasium</a></ytd-video-owner-renderer></body></html>`,
    );
    expect(resolveChannelIdInPage(doc, "https://www.youtube.com/watch?v=x")).toBeNull();
  });

  it("returns null when independent sources disagree (ambiguous)", () => {
    const other = "UCXuqSBlHAE6Xw-yeJA0Tunw";
    const doc = parse(
      `<html><body>` +
        `<script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"x","channelId":"${VERITASIUM}"}};</script>` +
        `<ytd-video-owner-renderer><a href="/channel/${other}">X</a></ytd-video-owner-renderer>` +
        `</body></html>`,
    );
    expect(resolveChannelIdInPage(doc, "https://www.youtube.com/watch?v=x")).toBeNull();
  });

  it("does NOT trust a stale script whose videoId differs from the current URL", () => {
    const stale = "UCXuqSBlHAE6Xw-yeJA0Tunw";
    const doc = parse(
      `<html><body><script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"AAA","channelId":"${stale}"}};</script></body></html>`,
    );
    expect(resolveChannelIdInPage(doc, "https://www.youtube.com/watch?v=BBB")).toBeNull();
  });

  it("never throws on malformed input", () => {
    const doc = parse(
      `<html><body><script>var ytInitialPlayerResponse = {oops;</script></body></html>`,
    );
    expect(resolveChannelIdInPage(doc, "https://www.youtube.com/watch?v=x")).toBeNull();
  });
});
