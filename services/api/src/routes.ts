import { Hono } from "hono";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z, ZodError } from "zod";
import {
  ChannelLookupPayload,
  CORRECTION_RECEIVED,
  CorrectionSubmission,
  RESEARCH_LEAD_RECEIVED,
  ResearchLeadSubmission,
  YoutubeChannelId,
} from "@channelwatch/schemas";
import { getDb } from "./db/client.js";
import {
  assembleLookup,
  getChannelById,
  getChannelByYoutubeId,
  getEntity,
  getEvidence,
  getOwnership,
  getTimeline,
  searchChannels,
  unresearchedPayload,
} from "./db/queries.js";
import { insertCorrection, insertResearchLead } from "./db/writes.js";
import { ApiError, badRequest, errorEnvelope, notFound } from "./http/middleware.js";
import { createRateLimit } from "./http/rate-limit.js";

/** Maximum accepted POST body size (§32.1 abuse control). */
const MAX_POST_BODY_BYTES = 32 * 1024;

/**
 * Public `/api/v1` router (SPEC §17). Read endpoints and the two public POST
 * intake endpoints. Business/data assembly lives in `db/queries.ts` and
 * `db/writes.ts`; this file is the thin HTTP layer: parse + validate input,
 * pick a status code, delegate.
 */

const Uuid = z.uuid();

/** Parse a JSON body, turning malformed JSON into a clean 400 rather than a 500. */
async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw badRequest("Request body must be valid JSON.", "INVALID_JSON");
  }
}

export function createV1Router(): Hono {
  const v1 = new Hono();

  // Rate limiting: reads 60/min/IP, POSTs 5/min/IP (in-memory token bucket).
  const readLimit = createRateLimit({ capacity: 60, refillWindowMs: 60_000 });
  const postLimit = createRateLimit({ capacity: 5, refillWindowMs: 60_000 });
  v1.on(["GET"], "*", readLimit);
  v1.on(["POST"], "*", postLimit);

  // Cap POST bodies before they are buffered/parsed (`c.req.json()` would
  // otherwise read an unbounded body into memory). Over-limit → 413.
  v1.on(
    ["POST"],
    "*",
    bodyLimit({
      maxSize: MAX_POST_BODY_BYTES,
      onError: (c) =>
        c.json(errorEnvelope("PAYLOAD_TOO_LARGE", "Request body exceeds the 32KB limit."), 413),
    }),
  );

  // ---- Channel lookup (§17.2). Unknown/unresearched → 200 neutral payload,
  // NOT 404, so the extension renders a "not researched" state. A MALFORMED id
  // (not UC + 22 chars) is a client error → 400.
  v1.get("/channels/youtube/:youtubeChannelId", async (c) => {
    const raw = c.req.param("youtubeChannelId");
    const parsed = YoutubeChannelId.safeParse(raw);
    if (!parsed.success) {
      throw badRequest(
        "youtube_channel_id must be a canonical channel ID (UC + 22 characters).",
        "INVALID_CHANNEL_ID",
      );
    }
    const db = getDb();
    const channel = await getChannelByYoutubeId(db, parsed.data);
    const payload = channel ? await assembleLookup(db, channel) : unresearchedPayload(parsed.data);
    // Self-enforce the published contract at runtime before responding.
    return c.json(ChannelLookupPayload.parse(payload), 200);
  });

  // ---- Channel search.
  v1.get("/channels/search", async (c) => {
    const q = (c.req.query("q") ?? "").trim();
    if (q.length === 0) throw badRequest("Query parameter `q` is required.", "MISSING_QUERY");
    const results = await searchChannels(getDb(), q);
    return c.json({ query: q, count: results.length, results }, 200);
  });

  // ---- Ownership / evidence / timeline (by internal channel UUID).
  const loadChannelById = async (idRaw: string) => {
    const id = Uuid.safeParse(idRaw);
    if (!id.success) throw badRequest("Channel id must be a UUID.", "INVALID_ID");
    const channel = await getChannelById(getDb(), id.data);
    if (!channel) throw notFound("Channel not found.");
    return channel;
  };

  v1.get("/channels/:id/ownership", async (c) => {
    const channel = await loadChannelById(c.req.param("id"));
    return c.json(await getOwnership(getDb(), channel), 200);
  });

  v1.get("/channels/:id/evidence", async (c) => {
    const channel = await loadChannelById(c.req.param("id"));
    return c.json(await getEvidence(getDb(), channel), 200);
  });

  v1.get("/channels/:id/timeline", async (c) => {
    const channel = await loadChannelById(c.req.param("id"));
    return c.json(await getTimeline(getDb(), channel), 200);
  });

  // ---- Entity lookup.
  v1.get("/entities/:id", async (c) => {
    const id = Uuid.safeParse(c.req.param("id"));
    if (!id.success) throw badRequest("Entity id must be a UUID.", "INVALID_ID");
    const entity = await getEntity(getDb(), id.data);
    if (!entity) throw notFound("Entity not found.");
    return c.json(entity, 200);
  });

  // ---- Corrections + research-lead submissions (validated, audited).
  v1.post("/corrections", async (c) => {
    const body = CorrectionSubmission.parse(await readJson(c));
    const result = await insertCorrection(getDb(), body);
    return c.json({ ...result, message: CORRECTION_RECEIVED }, 201);
  });

  v1.post("/submissions", async (c) => {
    const body = ResearchLeadSubmission.parse(await readJson(c));
    const result = await insertResearchLead(getDb(), body);
    return c.json({ ...result, message: RESEARCH_LEAD_RECEIVED }, 201);
  });

  return v1;
}

/** Render a thrown error as the canonical JSON envelope. Shared by the root app. */
export function renderError(err: unknown, c: Context) {
  if (err instanceof ApiError) {
    return c.json(errorEnvelope(err.code, err.message), err.status);
  }
  if (err instanceof ZodError) {
    return c.json(
      errorEnvelope("VALIDATION_FAILED", "Request body failed validation.", err.issues),
      400,
    );
  }
  // Never leak internal error text to clients.
  return c.json(errorEnvelope("INTERNAL_ERROR", "An unexpected error occurred."), 500);
}
