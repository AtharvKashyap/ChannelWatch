import { ChannelLookupPayload } from "@channelwatch/schemas";

/** Request timeout — a hung request should fail fast into the apiError cache TTL. */
const REQUEST_TIMEOUT_MS = 8_000;

export type ApiLookupResult =
  { ok: true; payload: ChannelLookupPayload } | { ok: false; message: string };

/**
 * Fetches a channel's lookup record from the API (SPEC §17.2, §22.2). The
 * request carries only the channel id (in the URL path) and the extension
 * version (`X-Extension-Version` header) — never a page URL, video id, user
 * identity, or any other viewer-identifying data.
 */
export async function fetchChannelLookup(
  channelId: string,
  apiBaseUrl: string,
  extensionVersion: string,
): Promise<ApiLookupResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `${apiBaseUrl.replace(/\/+$/, "")}/api/v1/channels/youtube/${encodeURIComponent(channelId)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Extension-Version": extensionVersion,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, message: `API responded with status ${response.status}` };
    }

    const json: unknown = await response.json();
    const parsed = ChannelLookupPayload.safeParse(json);
    if (!parsed.success) {
      return { ok: false, message: "API response failed schema validation" };
    }

    return { ok: true, payload: parsed.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown network error";
    return { ok: false, message };
  } finally {
    clearTimeout(timeout);
  }
}
