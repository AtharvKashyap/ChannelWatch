import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "../mocks/chrome.js";
import { researchedFixture } from "../fixtures.js";
import { LOOKUP_CHANNEL } from "../../src/shared/messages.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LOOKUP_CHANNEL message round-trip", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("registers a LOOKUP_CHANNEL listener that fetches, caches, and responds", async () => {
    const { messageListeners } = installChromeMock("9.9.9");
    const payload = researchedFixture();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await import("../../src/background/index.js");

    expect(messageListeners).toHaveLength(1);
    const listener = messageListeners[0]!;

    const response = await new Promise((resolve) => {
      const keepAlive = listener(
        { type: LOOKUP_CHANNEL, channelId: "UC1111111111111111111111" },
        {},
        resolve,
      );
      expect(keepAlive).toBe(true);
    });

    expect(response).toEqual({ ok: true, payload, cached: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["X-Extension-Version"]).toBe("9.9.9");
  });

  it("serves the second lookup for the same channel from cache, without a second fetch", async () => {
    const { messageListeners } = installChromeMock();
    const payload = researchedFixture();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await import("../../src/background/index.js");
    const listener = messageListeners[0]!;

    const first = await new Promise((resolve) =>
      listener({ type: LOOKUP_CHANNEL, channelId: "UC3333333333333333333333" }, {}, resolve),
    );
    const second = await new Promise((resolve) =>
      listener({ type: LOOKUP_CHANNEL, channelId: "UC3333333333333333333333" }, {}, resolve),
    );

    expect(first).toEqual({ ok: true, payload, cached: false });
    expect(second).toEqual({ ok: true, payload, cached: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ignores messages that are not LOOKUP_CHANNEL requests", async () => {
    const { messageListeners } = installChromeMock();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );

    await import("../../src/background/index.js");
    const listener = messageListeners[0]!;

    const result = listener({ type: "SOMETHING_ELSE" }, {}, () => {
      throw new Error("sendResponse should not be called for unrelated messages");
    });
    expect(result).toBeUndefined();
  });

  it("caches an API error and does not cache it as a success", async () => {
    const { messageListeners } = installChromeMock();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );

    await import("../../src/background/index.js");
    const listener = messageListeners[0]!;

    const response = await new Promise((resolve) =>
      listener({ type: LOOKUP_CHANNEL, channelId: "UC4444444444444444444444" }, {}, resolve),
    );

    expect(response).toEqual({ ok: false, error: expect.any(String) });
  });
});
