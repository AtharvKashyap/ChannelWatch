import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchChannelLookup } from "../../src/background/api-client.js";
import { researchedFixture } from "../fixtures.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchChannelLookup", () => {
  it("sends only the channel id (path) and X-Extension-Version header", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(researchedFixture()), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchChannelLookup(
      "UC1111111111111111111111",
      "http://localhost:8787",
      "1.2.3",
    );

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:8787/api/v1/channels/youtube/UC1111111111111111111111");
    expect((init.headers as Record<string, string>)["X-Extension-Version"]).toBe("1.2.3");
  });

  it("returns an error result on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );

    const result = await fetchChannelLookup(
      "UC1111111111111111111111",
      "http://localhost:8787",
      "1.2.3",
    );
    expect(result.ok).toBe(false);
  });

  it("returns an error result when the response fails schema validation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ nonsense: true }), { status: 200 })),
    );

    const result = await fetchChannelLookup(
      "UC1111111111111111111111",
      "http://localhost:8787",
      "1.2.3",
    );
    expect(result.ok).toBe(false);
  });

  it("returns an error result when fetch throws (network failure)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const result = await fetchChannelLookup(
      "UC1111111111111111111111",
      "http://localhost:8787",
      "1.2.3",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("network down");
  });
});
