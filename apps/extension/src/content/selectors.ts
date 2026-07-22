/**
 * Centralized YouTube DOM selectors. EVERY selector the content script uses
 * lives here, as a named entry mapping to an ordered array of fallbacks — the
 * resolver/observer try each in turn until one matches. YouTube ships DOM
 * changes constantly; keeping selectors in one place (and covered by the
 * snapshot tests) means a breakage is a one-file, one-line fix rather than a
 * hunt through the codebase (see CLAUDE.md "Conventions").
 *
 * Ordering convention: most-specific / most-stable first, broad fallbacks last.
 */
export const SELECTORS = {
  /** `<link rel="canonical">` — channel pages point it at `/channel/UC…`. */
  canonicalLink: ['link[rel="canonical"]'],

  /** `<meta property="og:url">` — secondary source of the canonical channel URL. */
  ogUrl: ['meta[property="og:url"]'],

  /**
   * Scripts carrying YouTube's injected initial state. We only ever READ their
   * text content (never execute them) to parse the channel ID out of JSON.
   */
  initialStateScript: ["script"],

  /**
   * Watch-page video owner link. A resolved page renders the owner as an anchor
   * whose href is `/channel/UC…` (or, less usefully, `/@handle`). Scoped to the
   * owner renderer so we never pick up a recommended-video channel link.
   */
  watchOwnerLink: [
    "ytd-video-owner-renderer a[href]",
    "#owner ytd-channel-name a[href]",
    "#owner a[href]",
    "#upload-info a[href]",
  ],

  /** Microdata author URL on watch pages (often only a `/@handle`). */
  microdataAuthorUrl: [
    '[itemprop="author"] [itemprop="url"]',
    'span[itemprop="author"] link[itemprop="url"]',
  ],

  /**
   * Where the ownership badge is inserted next to the channel name on a WATCH
   * page (consumed by the Task 5 badge renderer; declared here so all DOM
   * anchoring is centralized). Ordered most-specific/most-stable first: the
   * hydrated owner renderer's channel-name node, then broader `#owner`
   * containers, then the pre-hydration skeleton's `#video-owner #upload-info`
   * (present in `tests/fixtures/watch-page.html`) as a last resort so the badge
   * still has a home if it renders before hydration.
   */
  watchBadgeAnchor: [
    "ytd-video-owner-renderer #channel-name",
    "#owner #channel-name",
    "#owner ytd-channel-name",
    "#owner",
    "#video-owner #upload-info",
    "#video-owner",
  ],

  /**
   * Where the badge is inserted in a CHANNEL-page header, next to the channel
   * title. YouTube's current channel header is the `yt-page-header` view-model;
   * older/tabbed headers used `#channel-header`/`c4-tabbed-header-renderer`.
   * Ordered newest→oldest with a broad `#channel-header-container` fallback. The
   * sanitized `channel-page.html` fixture is a pre-hydration skeleton with no
   * header node, so channel-page anchoring is covered by synthetic-DOM tests.
   */
  channelBadgeAnchor: [
    "yt-page-header-view-model .page-header-view-model-wiz__page-header-title",
    "yt-page-header-view-model h1",
    "#channel-header #channel-name",
    "#channel-header-container #channel-name",
    "ytd-c4-tabbed-header-renderer #channel-name",
    "#channel-header",
  ],
} as const;

export type SelectorName = keyof typeof SELECTORS;

/** First element in `root` matching any selector in the named fallback list. */
export function queryFirst(root: ParentNode, name: SelectorName): Element | null {
  for (const selector of SELECTORS[name]) {
    const el = root.querySelector(selector);
    if (el) return el;
  }
  return null;
}

/** All elements matching any selector in the list, de-duplicated, order-preserving. */
export function queryAll(root: ParentNode, name: SelectorName): Element[] {
  const seen = new Set<Element>();
  for (const selector of SELECTORS[name]) {
    for (const el of root.querySelectorAll(selector)) seen.add(el);
  }
  return [...seen];
}
