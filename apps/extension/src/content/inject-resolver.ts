/**
 * Self-contained watch-page channel-ID resolver, designed to be INJECTED into a
 * YouTube tab on demand via `chrome.scripting.executeScript({ func })`.
 *
 * Why self-contained: `executeScript` serializes the function with
 * `Function.prototype.toString()` and re-parses it inside the page. The injected
 * function therefore MUST reference only its own arguments and page globals
 * (`document`, `window`) — NEVER module imports or outer-scope bindings, because
 * none of that is carried across the serialization boundary. Every helper is
 * consequently declared INSIDE `resolveChannelIdInPage`, and the DOM selectors
 * that live in `selectors.ts` for the reusable resolver are INLINED here.
 *
 * The pure, reusable `resolveChannelId(doc, url)` in `channel-resolver.ts` (and
 * its `selectors.ts`) remain as the reference implementation and are covered by
 * their own unit + selector-health tests; this function ports the watch-page
 * subset of that logic into a single dependency-free unit.
 *
 * Privacy (CLAUDE.md rule 5): this runs ONLY when the user opens the popup — it
 * is injected on click, never persistently. It reads nothing but the channel ID
 * from the live document, renders nothing into the page, and stores nothing.
 *
 * Contract: watch pages only (`/watch`, `/shorts/…`, `/live/…`). Returns the
 * immutable `UC…` id, or `null` on a non-watch page or whenever the channel
 * cannot be determined unambiguously. Never throws (a thrown error would reject
 * the `executeScript` promise; the popup treats that as unresolved regardless,
 * but we fail soft here too).
 *
 * `doc`/`url` default to the page globals so `executeScript` can invoke it with
 * no args; the defaults also make the function unit-testable by passing a parsed
 * snapshot document and its URL explicitly.
 */
export function resolveChannelIdInPage(
  doc: Document = document,
  url: string = document.URL,
): string | null {
  /** Canonical immutable channel-ID shape: `UC` + 22 base64url chars. */
  const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;

  function isChannelId(value: unknown): value is string {
    return typeof value === "string" && CHANNEL_ID_RE.test(value);
  }

  /** Extract a `/channel/UC…` ID from an href/URL string, else null. */
  function channelIdFromUrl(href: string | null | undefined): string | null {
    if (!href) return null;
    const match = /\/channel\/(UC[A-Za-z0-9_-]{22})(?:[/?#]|$)/.exec(href);
    return match ? match[1]! : null;
  }

  /** Watch pages only: `/watch`, `/shorts/…`, `/live/…`. */
  function isWatchPage(pageUrl: string): boolean {
    try {
      const path = new URL(pageUrl, "https://www.youtube.com").pathname;
      return path === "/watch" || path.startsWith("/shorts/") || path.startsWith("/live/");
    } catch {
      return false;
    }
  }

  /** The video ID the URL currently points at (`?v=` or `/shorts|live/<id>`). */
  function currentVideoId(pageUrl: string): string | null {
    try {
      const u = new URL(pageUrl, "https://www.youtube.com");
      const v = u.searchParams.get("v");
      if (v) return v;
      const m = /^\/(?:shorts|live)\/([^/?#]+)/.exec(u.pathname);
      return m ? m[1]! : null;
    } catch {
      return null;
    }
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

  /**
   * Parse a `var <name> = { … };` assignment out of the page's scripts and
   * return the parsed object. Returns null on any failure.
   */
  function parseInitialState(varName: string): unknown {
    const needle = `${varName} =`;
    for (const script of Array.from(doc.querySelectorAll("script"))) {
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

  /** Safely walk a nested object by key/index path; null if any hop is missing. */
  function dig(obj: unknown, path: (string | number)[]): unknown {
    let cur: unknown = obj;
    for (const key of path) {
      if (cur == null || typeof cur !== "object") return null;
      cur = (cur as Record<string | number, unknown>)[key];
    }
    return cur ?? null;
  }

  /**
   * A script's injected `ytInitialData`/`ytInitialPlayerResponse` is written on
   * first HTML load and never rewritten on SPA navigation. Only trust a script
   * whose embedded video ID equals the current URL's video ID; otherwise it is
   * stale (describes a previously-viewed video) and must be dropped, or we would
   * emit the wrong channel — the project's worst-case failure.
   */
  function scriptIsFresh(scriptVideoId: unknown, expected: string | null): boolean {
    return expected !== null && typeof scriptVideoId === "string" && scriptVideoId === expected;
  }

  const expectedVideoId = currentVideoId(url);

  function fromPlayerResponse(): string | null {
    const details = dig(parseInitialState("ytInitialPlayerResponse"), ["videoDetails"]);
    if (!scriptIsFresh(dig(details, ["videoId"]), expectedVideoId)) return null;
    const id = dig(details, ["channelId"]);
    return isChannelId(id) ? id : null;
  }

  function fromWatchInitialData(): string | null {
    const data = parseInitialState("ytInitialData");
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

  /** First element matching any selector in an ordered fallback list. */
  function queryFirst(selectors: string[]): Element | null {
    for (const selector of selectors) {
      const el = doc.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function fromOwnerLink(): string | null {
    const el = queryFirst([
      "ytd-video-owner-renderer a[href]",
      "#owner ytd-channel-name a[href]",
      "#owner a[href]",
      "#upload-info a[href]",
    ]);
    return channelIdFromUrl(el?.getAttribute("href"));
  }

  function fromMicrodataAuthor(): string | null {
    // Author microdata usually carries only a `/@handle` → not resolvable (M3).
    const el = queryFirst([
      '[itemprop="author"] [itemprop="url"]',
      'span[itemprop="author"] link[itemprop="url"]',
    ]);
    if (!el) return null;
    return channelIdFromUrl(el.getAttribute("href") ?? el.getAttribute("content"));
  }

  /**
   * Run each strategy, collect distinct IDs. Exactly one → resolved. Zero → not
   * found. More than one → sources disagree → ambiguous. Both non-singleton
   * outcomes return null (a miss is acceptable; a wrong answer is not).
   */
  function reconcile(strategies: Array<() => string | null>): string | null {
    const found = new Set<string>();
    for (const strategy of strategies) {
      const id = strategy();
      if (id) found.add(id);
    }
    return found.size === 1 ? [...found][0]! : null;
  }

  try {
    if (!isWatchPage(url)) return null;
    return reconcile([
      fromPlayerResponse,
      fromWatchInitialData,
      fromOwnerLink,
      fromMicrodataAuthor,
    ]);
  } catch {
    return null;
  }
}
