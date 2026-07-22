import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onChannelResolved, resolveAndLookup } from "../../src/content/index.js";
import { LOOKUP_CHANNEL } from "../../src/shared/messages.js";
import { researchedFixture } from "../fixtures.js";

const VERITASIUM = "UCHnyfMqiRRG1u-2MsSQLbXA";

function stubSendMessage(response: unknown) {
  const sendMessage = vi.fn(async () => response);
  (globalThis as { chrome?: unknown }).chrome = { runtime: { sendMessage } };
  return sendMessage;
}

describe("content pipeline: resolve → LOOKUP_CHANNEL → notify subscribers", () => {
  beforeEach(() => {
    document.body.innerHTML = `<script>var ytInitialPlayerResponse = {"videoDetails":{"channelId":"${VERITASIUM}"}};</script>`;
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

    const received: Array<{ channelId: string }> = [];
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
});
