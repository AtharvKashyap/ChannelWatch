import { ChannelLookupPayload, CorrectionSubmission } from "@channelwatch/schemas";

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

export type ApiSubmitResult = { ok: true } | { ok: false; message: string };

/**
 * POSTs a public correction to the API (SPEC §17.1, §23.3). The `submission` is
 * validated against `CorrectionSubmission` here (again — the panel validated it
 * too) so a malformed body never reaches the network, and the request body is
 * exactly the validated submission: channel id + what the user typed, nothing
 * else (privacy, CLAUDE.md rule 5). Like the lookup, it carries only the
 * extension version header — no viewer-identifying data.
 */
export async function submitCorrection(
  submission: unknown,
  apiBaseUrl: string,
  extensionVersion: string,
): Promise<ApiSubmitResult> {
  const parsed = CorrectionSubmission.safeParse(submission);
  if (!parsed.success) {
    return { ok: false, message: "Correction failed schema validation" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `${apiBaseUrl.replace(/\/+$/, "")}/api/v1/corrections`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Extension-Version": extensionVersion,
      },
      body: JSON.stringify(parsed.data),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, message: `API responded with status ${response.status}` };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown network error";
    return { ok: false, message };
  } finally {
    clearTimeout(timeout);
  }
}
