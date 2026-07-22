/**
 * Channel-ID resolution. Given a YouTube page's Document + URL, extract the
 * immutable `UC…` channel ID — or return `null` when it cannot be determined
 * unambiguously.
 *
 * Hard rules (CLAUDE.md #4, #8 — "precision over recall"):
 *   - Channels are identified ONLY by the immutable `UC…` ID. We NEVER infer a
 *     channel from a display name or a bare `@handle`.
 *   - A `@handle` with no accompanying `UC…` needs a backend lookup; that is
 *     deferred to M3 — for now such pages resolve to `null`.
 *   - When independent sources disagree, the result is ambiguous → `null`.
 *     A missed resolution is acceptable; a wrong one is not.
 *
 * Every path is defensive: malformed JSON, missing nodes, and unexpected shapes
 * yield `null`, never a throw (the content script must never break YouTube).
 */
import { queryAll, queryFirst } from "./selectors.js";

/** Canonical immutable channel-ID shape: `UC` + 22 base64url chars. */
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;

function isChannelId(value: unknown): value is string {
  return typeof value === "string" && CHANNEL_ID_RE.test(value);
}

/** Extract a `/channel/UC…` ID from an href/URL string, else null. */
function channelIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /\/channel\/(UC[A-Za-z0-9_-]{22})(?:[/?#]|$)/.exec(url);
  return match ? match[1]! : null;
}

/**
 * The video ID the URL is CURRENTLY pointing at (`?v=` on `/watch`, or the path
 * segment on `/shorts/…` and `/live/…`). Used to detect stale initial-state
 * scripts after SPA navigation (see `scriptIsFresh`). Null if unknown.
 */
function currentVideoId(url: string): string | null {
  try {
    const u = new URL(url, "https://www.youtube.com");
    const v = u.searchParams.get("v");
    if (v) return v;
    const m = /^\/(?:shorts|live)\/([^/?#]+)/.exec(u.pathname);
    return m ? m[1]! : null;
  } catch {
    return null;
  }
}

/** Which kind of page is this, by URL path? */
type PageKind = "watch" | "channel" | "other";
function pageKind(url: string): PageKind {
  let path: string;
  try {
    path = new URL(url, "https://www.youtube.com").pathname;
  } catch {
    return "other";
  }
  if (path === "/watch" || path.startsWith("/shorts/") || path.startsWith("/live/")) return "watch";
  if (
    path.startsWith("/channel/") ||
    path.startsWith("/@") ||
    path.startsWith("/c/") ||
    path.startsWith("/user/")
  ) {
    return "channel";
  }
  return "other";
}

/**
 * Parse a `var <name> = { … };` assignment out of the page's scripts and return
 * the parsed object. YouTube injects `ytInitialData` / `ytInitialPlayerResponse`
 * this way. Returns null on any failure.
 */
function parseInitialState(doc: Document, varName: string): unknown {
  const needle = `${varName} =`;
  for (const script of queryAll(doc, "initialStateScript")) {
    const text = script.textContent;
    if (!text || !text.includes(needle)) continue;
    const start = text.indexOf("{", text.indexOf(needle));
    if (start === -1) continue;
    const json = extractBalancedObject(text, start);
    if (!json) continue;
    try {
      return JSON.parse(json);
    } catch {
      /* malformed — try the next script */
    }
  }
  return null;
}

/** Slice a balanced `{…}` object starting at `start`, respecting strings/escapes. */
function extractBalancedObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Safely walk a nested object by key/index path; null if any hop is missing. */
function dig(obj: unknown, path: (string | number)[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return null;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur ?? null;
}

// ---- watch-page strategies -------------------------------------------------

/**
 * Is a script's own video ID fresh for the page we're on? YouTube injects
 * `ytInitialData` / `ytInitialPlayerResponse` on the FIRST HTML load and never
 * rewrites them on subsequent SPA navigations. So after navigating video A → B,
 * these scripts still describe A while the DOM hydrates to B. Trusting them then
 * would emit A's channel for B — the project's worst-case failure (a wrong
 * attribution). We therefore only trust a script whose embedded video ID equals
 * the current URL's video ID; otherwise the script is stale and dropped, leaving
 * resolution to the freshly-hydrated DOM (owner anchor) — or null until it is.
 */
function scriptIsFresh(scriptVideoId: unknown, expected: string | null): boolean {
  return expected !== null && typeof scriptVideoId === "string" && scriptVideoId === expected;
}

function fromPlayerResponse(doc: Document, expectedVideoId: string | null): string | null {
  const details = dig(parseInitialState(doc, "ytInitialPlayerResponse"), ["videoDetails"]);
  const videoId = dig(details, ["videoId"]);
  if (!scriptIsFresh(videoId, expectedVideoId)) return null;
  const id = dig(details, ["channelId"]);
  return isChannelId(id) ? id : null;
}

function fromWatchInitialData(doc: Document, expectedVideoId: string | null): string | null {
  const data = parseInitialState(doc, "ytInitialData");
  const videoId = dig(data, ["currentVideoEndpoint", "watchEndpoint", "videoId"]);
  if (!scriptIsFresh(videoId, expectedVideoId)) return null;
  const id = dig(data, [
    "contents",
    "twoColumnWatchNextResults",
    "results",
    "results",
    "contents",
    1,
    "videoSecondaryInfoRenderer",
    "owner",
    "videoOwnerRenderer",
    "navigationEndpoint",
    "browseEndpoint",
    "browseId",
  ]);
  return isChannelId(id) ? id : null;
}

function fromOwnerLink(doc: Document): string | null {
  const el = queryFirst(doc, "watchOwnerLink");
  return channelIdFromUrl(el?.getAttribute("href"));
}

/** Read a URL off a microdata node: `href` on `<a>`/`<link>`, `content` on `<meta>`. */
function microdataUrl(el: Element | null): string | null {
  if (!el) return null;
  return el.getAttribute("href") ?? el.getAttribute("content");
}

function fromMicrodataAuthor(doc: Document): string | null {
  // Author microdata usually carries only a `/@handle` → not resolvable (M3).
  return channelIdFromUrl(microdataUrl(queryFirst(doc, "microdataAuthorUrl")));
}

// ---- channel-page strategies -----------------------------------------------

function fromCanonical(doc: Document): string | null {
  return channelIdFromUrl(queryFirst(doc, "canonicalLink")?.getAttribute("href"));
}

function fromOgUrl(doc: Document): string | null {
  return channelIdFromUrl(queryFirst(doc, "ogUrl")?.getAttribute("content"));
}

function fromChannelMetadata(doc: Document): string | null {
  const id = dig(parseInitialState(doc, "ytInitialData"), [
    "metadata",
    "channelMetadataRenderer",
    "externalId",
  ]);
  return isChannelId(id) ? id : null;
}

/**
 * Run each strategy, collect the distinct IDs found. Exactly one distinct ID →
 * resolved. Zero → not found. More than one → sources disagree → ambiguous.
 * Either "not found" or "ambiguous" returns null.
 */
function reconcile(strategies: Array<() => string | null>): string | null {
  const found = new Set<string>();
  for (const strategy of strategies) {
    const id = strategy();
    if (id) found.add(id);
  }
  return found.size === 1 ? [...found][0]! : null;
}

/**
 * Resolve the channel ID for `url`'s page from `doc`. Never throws.
 */
export function resolveChannelId(doc: Document, url: string): string | null {
  try {
    switch (pageKind(url)) {
      case "watch": {
        const videoId = currentVideoId(url);
        return reconcile([
          () => fromPlayerResponse(doc, videoId),
          () => fromWatchInitialData(doc, videoId),
          () => fromOwnerLink(doc),
          () => fromMicrodataAuthor(doc),
        ]);
      }
      case "channel":
        return reconcile([
          () => fromCanonical(doc),
          () => fromOgUrl(doc),
          () => fromChannelMetadata(doc),
        ]);
      default:
        return null;
    }
  } catch (err) {
    console.debug("[channelwatch] resolveChannelId failed", err);
    return null;
  }
}
