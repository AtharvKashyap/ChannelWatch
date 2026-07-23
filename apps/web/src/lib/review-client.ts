import {
  AuditListResponse,
  ClaimQueueResponse,
  CorrectionInboxResponse,
  EntityListResponse,
  EntityRecord,
  ReviewActionResponse,
  SessionResponse,
  type AuditListResponse as AuditListResponseType,
  type ClaimQueueResponse as ClaimQueueResponseType,
  type CorrectionInboxResponse as CorrectionInboxResponseType,
  type EntityCreateRequest,
  type EntityListResponse as EntityListResponseType,
  type EntityRecord as EntityRecordType,
  type EntityUpdateRequest,
  type ReviewActionResponse as ReviewActionResponseType,
  type SessionResponse as SessionResponseType,
} from "@channelwatch/schemas";
import { apiBaseUrl, type ApiResult } from "./api-client.js";

/**
 * Typed client for the AUTHED reviewer API (`/api/v1/auth`, `/api/v1/reviewer`).
 * Mirrors `api-client.ts`: every response is validated against the
 * `@channelwatch/schemas` schemas (the single source of truth), so a drifting
 * API fails loudly. All calls send `credentials: "include"` so the HttpOnly
 * session cookie rides along on the cross-origin (same-site) request.
 */

const REQUEST_TIMEOUT_MS = 8_000;

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, credentials: "include", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function requestJson<T>(
  path: string,
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } },
  init: RequestInit = {},
  baseUrl: string = apiBaseUrl(),
): Promise<ApiResult<T>> {
  try {
    const res = await timedFetch(`${baseUrl}${path}`, {
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      ...init,
    });
    if (res.status === 401) return { ok: false, message: "UNAUTHENTICATED" };
    if (!res.ok) return { ok: false, message: `API responded with status ${res.status}` };
    const json: unknown = await res.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) return { ok: false, message: "API response failed schema validation" };
    return { ok: true, data: parsed.data };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Unknown network error" };
  }
}

// ---- Auth ----------------------------------------------------------------

export function login(
  email: string,
  password: string,
  baseUrl: string = apiBaseUrl(),
): Promise<ApiResult<SessionResponseType>> {
  return requestJson(
    "/api/v1/auth/login",
    SessionResponse,
    { method: "POST", body: JSON.stringify({ email, password }) },
    baseUrl,
  );
}

export async function logout(baseUrl: string = apiBaseUrl()): Promise<void> {
  try {
    await timedFetch(`${baseUrl}/api/v1/auth/logout`, { method: "POST" });
  } catch {
    // Logout is best-effort; a network failure still clears the client shell.
  }
}

export function fetchMe(baseUrl: string = apiBaseUrl()): Promise<ApiResult<SessionResponseType>> {
  return requestJson("/api/v1/auth/me", SessionResponse, {}, baseUrl);
}

// ---- Claim queue ---------------------------------------------------------

export function fetchClaimQueue(
  status?: string,
  baseUrl: string = apiBaseUrl(),
): Promise<ApiResult<ClaimQueueResponseType>> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return requestJson(`/api/v1/reviewer/claims${qs}`, ClaimQueueResponse, {}, baseUrl);
}

export function approveClaim(
  claimId: string,
  reasoning: string,
  baseUrl: string = apiBaseUrl(),
): Promise<ApiResult<ReviewActionResponseType>> {
  return requestJson(
    `/api/v1/reviewer/claims/${encodeURIComponent(claimId)}/approve`,
    ReviewActionResponse,
    { method: "POST", body: JSON.stringify({ reasoning }) },
    baseUrl,
  );
}

export function rejectClaim(
  claimId: string,
  reasoning: string,
  baseUrl: string = apiBaseUrl(),
): Promise<ApiResult<ReviewActionResponseType>> {
  return requestJson(
    `/api/v1/reviewer/claims/${encodeURIComponent(claimId)}/reject`,
    ReviewActionResponse,
    { method: "POST", body: JSON.stringify({ reasoning }) },
    baseUrl,
  );
}

// ---- Entities ------------------------------------------------------------

export function fetchEntities(
  baseUrl: string = apiBaseUrl(),
): Promise<ApiResult<EntityListResponseType>> {
  return requestJson("/api/v1/reviewer/entities", EntityListResponse, {}, baseUrl);
}

export function createEntity(
  body: EntityCreateRequest,
  baseUrl: string = apiBaseUrl(),
): Promise<ApiResult<EntityRecordType>> {
  return requestJson(
    "/api/v1/reviewer/entities",
    EntityRecord,
    { method: "POST", body: JSON.stringify(body) },
    baseUrl,
  );
}

export function updateEntity(
  id: string,
  body: EntityUpdateRequest,
  baseUrl: string = apiBaseUrl(),
): Promise<ApiResult<EntityRecordType>> {
  return requestJson(
    `/api/v1/reviewer/entities/${encodeURIComponent(id)}`,
    EntityRecord,
    { method: "PATCH", body: JSON.stringify(body) },
    baseUrl,
  );
}

/** Passthrough validator for endpoints whose exact body shape we do not assert. */
const passthrough = {
  safeParse: (v: unknown) => ({ success: true as const, data: v }),
};

// ---- Corrections ---------------------------------------------------------

export function fetchCorrections(
  status?: string,
  baseUrl: string = apiBaseUrl(),
): Promise<ApiResult<CorrectionInboxResponseType>> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return requestJson(`/api/v1/reviewer/corrections${qs}`, CorrectionInboxResponse, {}, baseUrl);
}

export function resolveCorrection(
  id: string,
  reasoning: string,
  baseUrl: string = apiBaseUrl(),
): Promise<ApiResult<unknown>> {
  return requestJson(
    `/api/v1/reviewer/corrections/${encodeURIComponent(id)}/resolve`,
    passthrough,
    { method: "POST", body: JSON.stringify({ reasoning }) },
    baseUrl,
  );
}

export function dismissCorrection(
  id: string,
  reasoning: string,
  baseUrl: string = apiBaseUrl(),
): Promise<ApiResult<unknown>> {
  return requestJson(
    `/api/v1/reviewer/corrections/${encodeURIComponent(id)}/dismiss`,
    passthrough,
    { method: "POST", body: JSON.stringify({ reasoning }) },
    baseUrl,
  );
}

// ---- Audit ---------------------------------------------------------------

export function fetchAudit(
  options: { subjectId?: string; limit?: number; offset?: number } = {},
  baseUrl: string = apiBaseUrl(),
): Promise<ApiResult<AuditListResponseType>> {
  const params = new URLSearchParams();
  if (options.subjectId) params.set("subjectId", options.subjectId);
  if (options.limit != null) params.set("limit", String(options.limit));
  if (options.offset != null) params.set("offset", String(options.offset));
  const qs = params.toString() ? `?${params.toString()}` : "";
  return requestJson(`/api/v1/reviewer/audit${qs}`, AuditListResponse, {}, baseUrl);
}
