import { describe, expect, it, vi } from "vitest";
import { startUi, type UiDeps } from "../../src/content/ui-controller.js";
import { BADGE_HOST_ID } from "../../src/content/badge-renderer.js";
import { DEFAULT_SETTINGS } from "../../src/shared/settings.js";
import { researchedFixture } from "../fixtures.js";
import type { ChannelResolved } from "../../src/content/index.js";

const WATCH_URL = "https://www.youtube.com/watch?v=x";

function watchDoc(): Document {
  const doc = document.implementation.createHTMLDocument("watch");
  doc.body.innerHTML =
    '<ytd-video-owner-renderer><div id="channel-name">Chan</div></ytd-video-owner-renderer>';
  return doc;
}

function makeDeps(doc: Document) {
  let subscriber: ((r: ChannelResolved) => void) | null = null;
  const openPanel = vi.fn();
  const closePanel = vi.fn();
  const deps: UiDeps = {
    doc,
    getUrl: () => WATCH_URL,
    getSettings: async () => ({ ...DEFAULT_SETTINGS }),
    subscribe: (cb) => {
      subscriber = cb;
      return () => {
        subscriber = null;
      };
    },
    getLast: () => null,
    openPanel,
    closePanel,
  };
  return { deps, emit: (r: ChannelResolved) => subscriber?.(r), openPanel, closePanel };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("startUi", () => {
  it("renders a badge when a researched channel resolves", async () => {
    const doc = watchDoc();
    const { deps, emit } = makeDeps(doc);
    const stop = startUi(deps);

    emit({
      channelId: "UCabc",
      response: { ok: true, payload: researchedFixture(), cached: false },
    });
    await flush();

    expect(doc.querySelectorAll(`#${BADGE_HOST_ID}`)).toHaveLength(1);
    stop();
  });

  it("clears the badge and closes the panel on a null (clear) resolution", async () => {
    const doc = watchDoc();
    const { deps, emit, closePanel } = makeDeps(doc);
    const stop = startUi(deps);

    emit({
      channelId: "UCabc",
      response: { ok: true, payload: researchedFixture(), cached: false },
    });
    await flush();
    expect(doc.querySelectorAll(`#${BADGE_HOST_ID}`)).toHaveLength(1);

    emit({ channelId: null, response: null });
    await flush();

    expect(doc.querySelectorAll(`#${BADGE_HOST_ID}`)).toHaveLength(0);
    expect(closePanel).toHaveBeenCalled();
    stop();
  });

  it("teardown removes the badge and unsubscribes", async () => {
    const doc = watchDoc();
    const { deps, emit } = makeDeps(doc);
    const stop = startUi(deps);
    emit({
      channelId: "UCabc",
      response: { ok: true, payload: researchedFixture(), cached: false },
    });
    await flush();

    stop();
    expect(doc.querySelectorAll(`#${BADGE_HOST_ID}`)).toHaveLength(0);
    // after teardown, further emits are ignored (no throw, no re-render)
    emit({
      channelId: "UCabc",
      response: { ok: true, payload: researchedFixture(), cached: false },
    });
    await flush();
    expect(doc.querySelectorAll(`#${BADGE_HOST_ID}`)).toHaveLength(0);
  });
});
