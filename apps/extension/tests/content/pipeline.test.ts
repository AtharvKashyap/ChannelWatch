import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onChannelResolved, resolveAndLookup, teardown } from "../../src/content/index.js";
import { LOOKUP_CHANNEL } from "../../src/shared/messages.js";
import { researchedFixture } from "../fixtures.js";

const VERITASIUM = "UCHnyfMqiRRG1u-2MsSQLbXA";
const OTHER = "UCXuqSBlHAE6Xw-yeJA0Tunw";

/** A fresh watch-page script for `videoId` owned by `channelId`. */
const watchDom = (videoId: string, channelId: string) =>
  `<script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"${videoId}","channelId":"${channelId}"}};</script>`;

function stubSendMessage(response: unknown) {
  const sendMessage = vi.fn(async () => response);
  (globalThis as { chrome?: unknown }).chrome = { runtime: { sendMessage } };
  return sendMessage;
}

describe("content pipeline: resolve → LOOKUP_CHANNEL → notify subscribers", () => {
  beforeEach(() => {
    teardown(); // reset dedup state so each test starts from "nothing shown"
    document.body.innerHTML = watchDom("x", VERITASIUM);
    Object.defineProperty(document, "URL", {
      value: "https://www.youtube.com/watch?v=x",
      configurable: true,
    });
  });
  afterEach(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
    vi.restoreAllMocks();
  });

  it("resolves the channel, sends LOOKUP_CHANNEL, and notifies subscribers", async () => {
    const payload = researchedFixture({ youtube_channel_id: VERITASIUM });
    const sendMessage = stubSendMessage({ ok: true, payload, cached: false });

    const received: Array<{ channelId: string | null }> = [];
    const unsubscribe = onChannelResolved((r) => received.push(r));

    await resolveAndLookup(document, "https://www.youtube.com/watch?v=x");

    expect(sendMessage).toHaveBeenCalledWith({ type: LOOKUP_CHANNEL, channelId: VERITASIUM });
    expect(received).toHaveLength(1);
    expect(received[0]!.channelId).toBe(VERITASIUM);
    unsubscribe();
  });

  it("does nothing (no message, no notification) when no channel resolves", async () => {
    const sendMessage = stubSendMessage({ ok: true });
    const cb = vi.fn();
    const unsubscribe = onChannelResolved(cb);

    await resolveAndLookup(document, "https://www.youtube.com/feed/subscriptions");

    expect(sendMessage).not.toHaveBeenCalled();
    expect(cb).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("a failed lookup still notifies subscribers with a null response, never throws", async () => {
    stubSendMessage(Promise.reject(new Error("SW gone")));
    const cb = vi.fn();
    const unsubscribe = onChannelResolved(cb);

    await expect(
      resolveAndLookup(document, "https://www.youtube.com/watch?v=x"),
    ).resolves.toBeUndefined();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]![0]).toMatchObject({ channelId: VERITASIUM, response: null });
    unsubscribe();
  });

  it("unsubscribe stops further notifications", async () => {
    stubSendMessage({ ok: true, payload: researchedFixture(), cached: false });
    const cb = vi.fn();
    const unsubscribe = onChannelResolved(cb);
    unsubscribe();

    await resolveAndLookup(document, "https://www.youtube.com/watch?v=x");
    expect(cb).not.toHaveBeenCalled();
  });

  it("suppresses re-send and re-notify when the resolved channel is unchanged", async () => {
    const sendMessage = stubSendMessage({ ok: true, payload: researchedFixture(), cached: false });
    const cb = vi.fn();
    const unsubscribe = onChannelResolved(cb);

    await resolveAndLookup(document, "https://www.youtube.com/watch?v=x");
    await resolveAndLookup(document, "https://www.youtube.com/watch?v=x");
    await resolveAndLookup(document, "https://www.youtube.com/watch?v=x");

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("propagates a genuine A→B channel change (re-send + re-notify for B)", async () => {
    const sendMessage = stubSendMessage({ ok: true, payload: researchedFixture(), cached: false });
    const cb = vi.fn();
    const unsubscribe = onChannelResolved(cb);

    await resolveAndLookup(document, "https://www.youtube.com/watch?v=x"); // A

    document.body.innerHTML = watchDom("y", OTHER);
    await resolveAndLookup(document, "https://www.youtube.com/watch?v=y"); // B

    expect(sendMessage).toHaveBeenNthCalledWith(1, { type: LOOKUP_CHANNEL, channelId: VERITASIUM });
    expect(sendMessage).toHaveBeenNthCalledWith(2, { type: LOOKUP_CHANNEL, channelId: OTHER });
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb.mock.calls[1]![0]).toMatchObject({ channelId: OTHER });
    unsubscribe();
  });

  it("notifies a clear (channelId null) when navigating from a channel to no-channel", async () => {
    const sendMessage = stubSendMessage({ ok: true, payload: researchedFixture(), cached: false });
    const cb = vi.fn();
    const unsubscribe = onChannelResolved(cb);

    await resolveAndLookup(document, "https://www.youtube.com/watch?v=x"); // A → badge
    cb.mockClear();

    // Navigate to a page with no unambiguous channel (e.g. the home feed).
    await resolveAndLookup(document, "https://www.youtube.com/feed/subscriptions");

    // No new lookup for the clear, exactly one clear notification.
    expect(sendMessage).toHaveBeenCalledTimes(1); // only the earlier A lookup
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]![0]).toEqual({ channelId: null, response: null });
    unsubscribe();
  });

  it("drops a stale out-of-order completion when a newer resolution has since started (latest-request-wins)", async () => {
    // A resolves slowly, B resolves fast. B's completion must win even though
    // A was dispatched first — A's late completion must produce no notify.
    let resolveA!: (v: unknown) => void;
    let resolveB!: (v: unknown) => void;
    const pendingA = new Promise((r) => {
      resolveA = r;
    });
    const pendingB = new Promise((r) => {
      resolveB = r;
    });

    const sendMessage = vi.fn();
    sendMessage.mockImplementationOnce(async () => pendingA);
    sendMessage.mockImplementationOnce(async () => pendingB);
    (globalThis as { chrome?: unknown }).chrome = { runtime: { sendMessage } };

    const cb = vi.fn();
    const unsubscribe = onChannelResolved(cb);

    // Dispatch A (slow), don't await yet.
    const aPromise = resolveAndLookup(document, "https://www.youtube.com/watch?v=x");

    // Dispatch B (fast) for a different channel before A completes.
    document.body.innerHTML = watchDom("y", OTHER);
    const bPromise = resolveAndLookup(document, "https://www.youtube.com/watch?v=y");

    // B completes first.
    const bPayload = {
      ok: true,
      payload: researchedFixture({ youtube_channel_id: OTHER }),
      cached: false,
    };
    resolveB(bPayload);
    await bPromise;

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]![0]).toMatchObject({ channelId: OTHER });

    // A completes late (stale) — must be dropped: no additional notify.
    const aPayload = {
      ok: true,
      payload: researchedFixture({ youtube_channel_id: VERITASIUM }),
      cached: false,
    };
    resolveA(aPayload);
    await aPromise;

    expect(cb).toHaveBeenCalledTimes(1); // still just B's notification
    unsubscribe();
  });
});
