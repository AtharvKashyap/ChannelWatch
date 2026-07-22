import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveChannelId } from "../../src/content/channel-resolver.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(here, "..", "fixtures", name), "utf-8");

const parse = (html: string): Document => new DOMParser().parseFromString(html, "text/html");

const VERITASIUM = "UCHnyfMqiRRG1u-2MsSQLbXA";

describe("resolveChannelId — watch page (fixture)", () => {
  const doc = parse(fixture("watch-page.html"));
  const url = "https://www.youtube.com/watch?v=AF8d72mA41M";

  it("resolves the video's channel ID from the real sanitized snapshot", () => {
    expect(resolveChannelId(doc, url)).toBe(VERITASIUM);
  });
});

describe("resolveChannelId — channel page (fixture)", () => {
  const doc = parse(fixture("channel-page.html"));
  const url = "https://www.youtube.com/@veritasium";

  it("resolves the channel ID from the real sanitized snapshot", () => {
    expect(resolveChannelId(doc, url)).toBe(VERITASIUM);
  });
});

describe("resolveChannelId — watch page strategies", () => {
  const url = "https://www.youtube.com/watch?v=x";

  it("prefers ytInitialPlayerResponse.videoDetails.channelId", () => {
    const doc = parse(
      `<html><body><script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"x","channelId":"${VERITASIUM}"}};</script></body></html>`,
    );
    expect(resolveChannelId(doc, url)).toBe(VERITASIUM);
  });

  it("falls back to a rendered owner anchor href (/channel/UC…)", () => {
    const doc = parse(
      `<html><body><ytd-video-owner-renderer><a href="/channel/${VERITASIUM}">Veritasium</a></ytd-video-owner-renderer></body></html>`,
    );
    expect(resolveChannelId(doc, url)).toBe(VERITASIUM);
  });

  it("returns null when the owner is only identified by @handle (deferred to M3)", () => {
    const doc = parse(
      `<html><body><span itemprop="author"><link itemprop="url" href="http://www.youtube.com/@veritasium"></span></body></html>`,
    );
    expect(resolveChannelId(doc, url)).toBeNull();
  });

  it("reads the microdata author URL from a <meta content> (not just href)", () => {
    const doc = parse(
      `<html><body><span itemprop="author"><meta itemprop="url" content="https://www.youtube.com/channel/${VERITASIUM}"></span></body></html>`,
    );
    expect(resolveChannelId(doc, url)).toBe(VERITASIUM);
  });

  it("NEVER resolves by display name", () => {
    const doc = parse(
      `<html><body><ytd-video-owner-renderer><a>Veritasium</a></ytd-video-owner-renderer></body></html>`,
    );
    expect(resolveChannelId(doc, url)).toBeNull();
  });

  it("returns null when independent sources disagree (ambiguous)", () => {
    const other = "UCXuqSBlHAE6Xw-yeJA0Tunw";
    const doc = parse(
      `<html><body>` +
        `<script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"x","channelId":"${VERITASIUM}"}};</script>` +
        `<ytd-video-owner-renderer><a href="/channel/${other}">X</a></ytd-video-owner-renderer>` +
        `</body></html>`,
    );
    expect(resolveChannelId(doc, url)).toBeNull();
  });
});

describe("resolveChannelId — stale initial-state after SPA navigation", () => {
  // ytInitialData / ytInitialPlayerResponse are injected on first load and never
  // rewritten on SPA nav. These simulate having navigated video A → video B while
  // the scripts still describe A. The resolver must NEVER report A's channel for B.
  const A_CHANNEL = "UCXuqSBlHAE6Xw-yeJA0Tunw"; // video A's channel (stale)
  const B_CHANNEL = VERITASIUM; // video B's channel (fresh)
  const staleScripts =
    `<script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"AAA","channelId":"${A_CHANNEL}"}};</script>` +
    `<script>var ytInitialData = {"currentVideoEndpoint":{"watchEndpoint":{"videoId":"AAA"}},` +
    `"contents":{"twoColumnWatchNextResults":{"results":{"results":{"contents":[{},` +
    `{"videoSecondaryInfoRenderer":{"owner":{"videoOwnerRenderer":{"navigationEndpoint":{"browseEndpoint":{"browseId":"${A_CHANNEL}"}}}}}}]}}}}};</script>`;
  const urlB = "https://www.youtube.com/watch?v=BBB";

  it("does NOT resolve the stale channel when the DOM has not yet hydrated (null in between)", () => {
    const doc = parse(`<html><body>${staleScripts}</body></html>`);
    expect(resolveChannelId(doc, urlB)).toBeNull();
  });

  it("resolves the NEW channel once the owner anchor has hydrated to B", () => {
    const doc = parse(
      `<html><body>${staleScripts}` +
        `<ytd-video-owner-renderer><a href="/channel/${B_CHANNEL}">B</a></ytd-video-owner-renderer>` +
        `</body></html>`,
    );
    expect(resolveChannelId(doc, urlB)).toBe(B_CHANNEL);
  });

  it("trusts the scripts again when their video ID matches the current URL", () => {
    const doc = parse(`<html><body>${staleScripts}</body></html>`);
    expect(resolveChannelId(doc, "https://www.youtube.com/watch?v=AAA")).toBe(A_CHANNEL);
  });

  it("resolves /shorts/<id> from a script whose videoId matches the path segment", () => {
    const doc = parse(
      `<html><body><script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"SHORT123","channelId":"${VERITASIUM}"}};</script></body></html>`,
    );
    expect(resolveChannelId(doc, "https://www.youtube.com/shorts/SHORT123")).toBe(VERITASIUM);
  });
});

describe("resolveChannelId — channel page strategies", () => {
  it("resolves from the canonical link", () => {
    const doc = parse(
      `<html><head><link rel="canonical" href="https://www.youtube.com/channel/${VERITASIUM}"></head></html>`,
    );
    expect(resolveChannelId(doc, "https://www.youtube.com/@veritasium")).toBe(VERITASIUM);
  });

  it("resolves from og:url when canonical is absent", () => {
    const doc = parse(
      `<html><head><meta property="og:url" content="https://www.youtube.com/channel/${VERITASIUM}"></head></html>`,
    );
    expect(resolveChannelId(doc, "https://www.youtube.com/c/veritasium")).toBe(VERITASIUM);
  });

  it("returns null for a handle-only page with no UC metadata (deferred to M3)", () => {
    const doc = parse(
      `<html><head><link rel="canonical" href="https://www.youtube.com/@veritasium"></head></html>`,
    );
    expect(resolveChannelId(doc, "https://www.youtube.com/@veritasium")).toBeNull();
  });
});

describe("resolveChannelId — non-YouTube-target pages", () => {
  it("returns null for an unrecognised path", () => {
    const doc = parse(`<html><body></body></html>`);
    expect(resolveChannelId(doc, "https://www.youtube.com/feed/subscriptions")).toBeNull();
  });

  it("never throws on malformed initial-state JSON", () => {
    const doc = parse(
      `<html><body><script>var ytInitialPlayerResponse = {not json;</script></body></html>`,
    );
    expect(resolveChannelId(doc, "https://www.youtube.com/watch?v=x")).toBeNull();
  });
});
