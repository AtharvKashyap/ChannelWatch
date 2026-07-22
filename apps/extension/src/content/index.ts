/**
 * Content-script entry point. Pipeline: observe YouTube SPA navigation →
 * resolve the immutable `UC…` channel ID → ask the background SW for its
 * ownership record (`LOOKUP_CHANNEL`) → hold the result and notify subscribers.
 *
 * The badge/panel UI (Task 5) subscribes via `onChannelResolved` (and can read
 * the most recent result synchronously via `getLastResolved`), so it can hook
 * in without any change to this file.
 *
 * Fail-silent (CLAUDE.md): every entry point is wrapped so a failure logs at
 * `console.debug` and never throws into the page. Only the channel ID +
 * extension version ever leave the page — enforced by the background SW.
 */
import { resolveChannelId } from "./channel-resolver.js";
import { startYouTubeObserver, type ObserverHandle } from "./youtube-observer.js";
import { LOOKUP_CHANNEL, type LookupChannelResponse } from "../shared/messages.js";

/** What subscribers receive: the resolved channel and its lookup outcome. */
export interface ChannelResolved {
  /**
   * The resolved immutable channel ID, or `null` when the current page has no
   * unambiguous channel (navigated away, or ambiguous) — Task 5 treats `null`
   * as "clear any badge".
   */
  channelId: string | null;
  /** The SW response, or `null` if there was no lookup / it could not complete. */
  response: LookupChannelResponse | null;
}

type Subscriber = (resolved: ChannelResolved) => void;

const subscribers = new Set<Subscriber>();
let lastResolved: ChannelResolved | null = null;
/**
 * The last channel ID we notified subscribers about (`null` = "nothing shown").
 * Used to suppress duplicate work: the body-level MutationObserver fires
 * onNavigate continuously, but we only send `LOOKUP_CHANNEL` / notify when the
 * resolved ID actually CHANGES — including genuine A→B changes and A→null
 * (clear) transitions.
 */
let lastChannelId: string | null = null;

/**
 * Register a callback invoked whenever a channel is resolved and looked up.
 * Returns an unsubscribe function. (Task 5's renderer hooks in here.)
 */
export function onChannelResolved(callback: Subscriber): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

/** The most recent resolution, for late subscribers (e.g. a renderer mounted after resolve). */
export function getLastResolved(): ChannelResolved | null {
  return lastResolved;
}

function notify(resolved: ChannelResolved): void {
  lastResolved = resolved;
  for (const callback of subscribers) {
    try {
      callback(resolved);
    } catch (err) {
      console.debug("[channelwatch] onChannelResolved subscriber threw", err);
    }
  }
}

/**
 * Resolve the channel for `url` from `doc`, look it up via the background SW,
 * and notify subscribers. Never throws.
 */
export async function resolveAndLookup(doc: Document, url: string): Promise<void> {
  try {
    const channelId = resolveChannelId(doc, url);

    // Nothing changed since the last notification — no re-send, no re-notify.
    // (Covers the continuous MutationObserver firings on a stable page, and
    // null→null on non-channel pages.)
    if (channelId === lastChannelId) return;

    // Transitioned to "no channel" (navigated away / became ambiguous): tell
    // subscribers to clear, without sending a lookup.
    if (channelId === null) {
      lastChannelId = null;
      notify({ channelId: null, response: null });
      return;
    }

    let response: LookupChannelResponse | null = null;
    try {
      response = (await chrome.runtime.sendMessage({
        type: LOOKUP_CHANNEL,
        channelId,
      })) as LookupChannelResponse;
    } catch (err) {
      // SW unreachable / message failed — surface a null response, never throw.
      console.debug("[channelwatch] LOOKUP_CHANNEL message failed", err);
      response = null;
    }

    lastChannelId = channelId;
    notify({ channelId, response });
  } catch (err) {
    console.debug("[channelwatch] resolveAndLookup failed", err);
  }
}

let observer: ObserverHandle | null = null;

/** Start observing navigation and resolving. Idempotent — no duplicate observers. */
export function bootstrap(): void {
  if (observer) return;
  observer = startYouTubeObserver({
    onNavigate: () => {
      void resolveAndLookup(document, document.URL);
    },
  });
}

/** Stop the pipeline and reset resolution state (mainly for tests / hot-reload). */
export function teardown(): void {
  observer?.teardown();
  observer = null;
  lastChannelId = null;
  lastResolved = null;
}

// Auto-start only inside a real extension content-script context (where
// `chrome.runtime.id` exists). Guarded so importing this module in unit tests
// has no side effects. The UI controller (badge + panel) is wired here — it
// subscribes to `onChannelResolved` before the observer starts resolving.
if (typeof chrome !== "undefined" && chrome.runtime?.id) {
  try {
    // Imported lazily so unit tests that import the pipeline API don't pull the
    // React panel bundle in.
    void import("./ui-controller.js")
      .then(({ mountUi }) => {
        mountUi();
        bootstrap();
      })
      .catch((err: unknown) => {
        console.debug("[channelwatch] UI mount failed", err);
      });
  } catch (err) {
    console.debug("[channelwatch] content bootstrap failed", err);
  }
}
