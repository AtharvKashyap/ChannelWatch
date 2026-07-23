import {
  ChannelEvidenceResponse,
  ChannelLookupPayload,
  ChannelSearchResponse,
  ChannelTimelineResponse,
  CorrectionSubmission,
  ResearchLeadSubmission,
  type ChannelEvidenceResponse as ChannelEvidenceResponseType,
  type ChannelLookupPayload as ChannelLookupPayloadType,
  type ChannelSearchResponse as ChannelSearchResponseType,
  type ChannelTimelineResponse as ChannelTimelineResponseType,
  type CorrectionSubmission as CorrectionSubmissionType,
  type ResearchLeadSubmission as ResearchLeadSubmissionType,
} from "@channelwatch/schemas";

/**
 * Typed client for the public `services/api` (`/api/v1`, SPEC §17). Every
 * response type comes from `@channelwatch/schemas` — the single source of truth
 * (CLAUDE.md); this module NEVER redefines a response shape. Responses are
 * validated with the same Zod schemas the API self-enforces, so a drifting API
 * fails loudly instead of yielding mistyped data (mirrors the extension's
 * `background/api-client.ts`).
 */

/** Request timeout — a hung request fails fast rather than hanging the page. */
const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Base URL of the API, from `NEXT_PUBLIC_API_BASE_URL` (baked at build for the
 * browser bundle, read from the environment on the server). Falls back to the
 * local dev API (`API_PORT` default, see `.env.example`). Trailing slashes are
 * stripped so path concatenation is stable.
 */
export function apiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";
  return raw.replace(/\/+$/, "");
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string };

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * `GET /api/v1/channels/youtube/:id`. Returns the discriminated
 * `ChannelLookupPayload` (researched | unresearched, SPEC §17.2). An unknown
 * channel is a valid 200 "not researched" payload, not an error.
 */
export async function fetchChannelLookup(
  channelId: string,
  baseUrl: string = apiBaseUrl(),
): Promise<ApiResult<ChannelLookupPayloadType>> {
  try {
    const url = `${baseUrl}/api/v1/channels/youtube/${encodeURIComponent(channelId)}`;
    const response = await timedFetch(url, { method: "GET" });
    if (!response.ok) {
      return { ok: false, message: `API responded with status ${response.status}` };
    }
    const json: unknown = await response.json();
    const parsed = ChannelLookupPayload.safeParse(json);
    if (!parsed.success) {
      return { ok: false, message: "API response failed schema validation" };
    }
    return { ok: true, data: parsed.data };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Unknown network error" };
  }
}

/**
 * `GET /api/v1/channels/search?q=…`. Returns matching channels (immutable
 * YouTube channel IDs + cached label). Validated against `ChannelSearchResponse`.
 */
export async function fetchChannelSearch(
  query: string,
  baseUrl: string = apiBaseUrl(),
): Promise<ApiResult<ChannelSearchResponseType>> {
  try {
    const url = `${baseUrl}/api/v1/channels/search?q=${encodeURIComponent(query)}`;
    const response = await timedFetch(url, { method: "GET" });
    if (!response.ok) {
      return { ok: false, message: `API responded with status ${response.status}` };
    }
    const parsed = ChannelSearchResponse.safeParse(await response.json());
    if (!parsed.success) return { ok: false, message: "API response failed schema validation" };
    return { ok: true, data: parsed.data };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Unknown network error" };
  }
}

/**
 * `GET /api/v1/channels/:id/evidence` (id = internal channel UUID, surfaced as
 * `channel_id` on the researched lookup). Returns itemized evidence sources.
 */
export async function fetchChannelEvidence(
  channelId: string,
  baseUrl: string = apiBaseUrl(),
): Promise<ApiResult<ChannelEvidenceResponseType>> {
  try {
    const url = `${baseUrl}/api/v1/channels/${encodeURIComponent(channelId)}/evidence`;
    const response = await timedFetch(url, { method: "GET" });
    if (!response.ok) {
      return { ok: false, message: `API responded with status ${response.status}` };
    }
    const parsed = ChannelEvidenceResponse.safeParse(await response.json());
    if (!parsed.success) return { ok: false, message: "API response failed schema validation" };
    return { ok: true, data: parsed.data };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Unknown network error" };
  }
}

/**
 * `GET /api/v1/channels/:id/timeline` (id = internal channel UUID). Returns the
 * channel's dated ownership events (relationships + claims), oldest-first.
 */
export async function fetchChannelTimeline(
  channelId: string,
  baseUrl: string = apiBaseUrl(),
): Promise<ApiResult<ChannelTimelineResponseType>> {
  try {
    const url = `${baseUrl}/api/v1/channels/${encodeURIComponent(channelId)}/timeline`;
    const response = await timedFetch(url, { method: "GET" });
    if (!response.ok) {
      return { ok: false, message: `API responded with status ${response.status}` };
    }
    const parsed = ChannelTimelineResponse.safeParse(await response.json());
    if (!parsed.success) return { ok: false, message: "API response failed schema validation" };
    return { ok: true, data: parsed.data };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Unknown network error" };
  }
}

/** Acknowledgement body shared by the two public POST intake endpoints. */
export interface SubmissionReceipt {
  message: string;
}

async function postSubmission(
  path: string,
  body: unknown,
  baseUrl: string,
): Promise<ApiResult<SubmissionReceipt>> {
  try {
    const response = await timedFetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return { ok: false, message: `API responded with status ${response.status}` };
    }
    const json = (await response.json()) as SubmissionReceipt;
    return { ok: true, data: json };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Unknown network error" };
  }
}

/**
 * `POST /api/v1/corrections` (SPEC §17.1, §23.3 "Report an Error"). The body is
 * validated against `CorrectionSubmission` before it leaves the client so a
 * malformed payload never reaches the network.
 */
export async function submitCorrection(
  submission: CorrectionSubmissionType,
  baseUrl: string = apiBaseUrl(),
): Promise<ApiResult<SubmissionReceipt>> {
  const parsed = CorrectionSubmission.safeParse(submission);
  if (!parsed.success) return { ok: false, message: "Correction failed schema validation" };
  return postSubmission("/api/v1/corrections", parsed.data, baseUrl);
}

/**
 * `POST /api/v1/submissions` (SPEC §17.1 "Submit Research Lead"). A lead, never
 * a published claim. Validated against `ResearchLeadSubmission` before sending.
 */
export async function submitResearchLead(
  submission: ResearchLeadSubmissionType,
  baseUrl: string = apiBaseUrl(),
): Promise<ApiResult<SubmissionReceipt>> {
  const parsed = ResearchLeadSubmission.safeParse(submission);
  if (!parsed.success) return { ok: false, message: "Research lead failed schema validation" };
  return postSubmission("/api/v1/submissions", parsed.data, baseUrl);
}
