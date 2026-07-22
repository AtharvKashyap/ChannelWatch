import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "../mocks/chrome.js";
import { SUBMIT_CORRECTION } from "../../src/shared/messages.js";
import type { CorrectionSubmission } from "@channelwatch/schemas";

afterEach(() => {
  vi.unstubAllGlobals();
});

const validSubmission: CorrectionSubmission = {
  youtube_channel_id: "UCHnyfMqiRRG1u-2MsSQLbXA",
  explanation: "This channel was acquired last year; the current owner is out of date.",
};

describe("SUBMIT_CORRECTION message round-trip", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("validates, POSTs to /api/v1/corrections, and responds ok", async () => {
    const { messageListeners } = installChromeMock("9.9.9");
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await import("../../src/background/index.js");
    const listener = messageListeners[0]!;

    const response = await new Promise((resolve) => {
      const keepAlive = listener(
        { type: SUBMIT_CORRECTION, submission: validSubmission },
        {},
        resolve,
      );
      expect(keepAlive).toBe(true);
    });

    expect(response).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/corrections$/);
    expect(init.method).toBe("POST");
    // Privacy: the POST body is EXACTLY the submission — channel id + typed
    // fields, nothing about the page the user was on.
    expect(JSON.parse(init.body as string)).toEqual(validSubmission);
    expect((init.headers as Record<string, string>)["X-Extension-Version"]).toBe("9.9.9");
  });

  it("rejects an invalid submission without fetching", async () => {
    const { messageListeners } = installChromeMock();
    const fetchMock = vi.fn(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await import("../../src/background/index.js");
    const listener = messageListeners[0]!;

    const response = await new Promise((resolve) =>
      listener(
        // explanation too short (< 20 chars) → schema rejects
        {
          type: SUBMIT_CORRECTION,
          submission: { youtube_channel_id: "UCHnyfMqiRRG1u-2MsSQLbXA", explanation: "nope" },
        },
        {},
        resolve,
      ),
    );

    expect(response).toEqual({ ok: false, error: expect.any(String) });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces an API failure as ok:false", async () => {
    const { messageListeners } = installChromeMock();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );

    await import("../../src/background/index.js");
    const listener = messageListeners[0]!;

    const response = await new Promise((resolve) =>
      listener({ type: SUBMIT_CORRECTION, submission: validSubmission }, {}, resolve),
    );

    expect(response).toEqual({ ok: false, error: expect.any(String) });
  });
});
