import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCurrentChannel } from "../../src/content/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(here, "..", "fixtures", name), "utf-8");
const parse = (html: string): Document => new DOMParser().parseFromString(html, "text/html");

const VERITASIUM = "UCHnyfMqiRRG1u-2MsSQLbXA";

describe("resolveCurrentChannel — watch pages only", () => {
  it("resolves the video's channel ID from the real watch-page snapshot", () => {
    const doc = parse(fixture("watch-page.html"));
    expect(resolveCurrentChannel(doc, "https://www.youtube.com/watch?v=AF8d72mA41M")).toBe(
      VERITASIUM,
    );
  });

  it("returns null on a channel page (channel-page behavior is deliberately disabled)", () => {
    const doc = parse(fixture("channel-page.html"));
    // The channel page snapshot DOES carry a resolvable UC id, but the popup
    // redesign scopes the extension to watch pages only — so the responder
    // must not report a channel here.
    expect(resolveCurrentChannel(doc, "https://www.youtube.com/@veritasium")).toBeNull();
  });

  it("returns null on the homepage", () => {
    const doc = parse("<html><body></body></html>");
    expect(resolveCurrentChannel(doc, "https://www.youtube.com/")).toBeNull();
  });

  it("resolves a /shorts/ watch page", () => {
    const doc = parse(
      `<html><body><script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"SHORT1","channelId":"${VERITASIUM}"}};</script></body></html>`,
    );
    expect(resolveCurrentChannel(doc, "https://www.youtube.com/shorts/SHORT1")).toBe(VERITASIUM);
  });

  it("never throws on malformed input", () => {
    const doc = parse(
      `<html><body><script>var ytInitialPlayerResponse = {oops;</script></body></html>`,
    );
    expect(resolveCurrentChannel(doc, "https://www.youtube.com/watch?v=x")).toBeNull();
  });
});
