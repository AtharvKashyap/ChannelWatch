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
  channelId: string;
  /** The SW response, or `null` if the lookup could not be completed. */
  response: LookupChannelResponse | null;
}

type Subscriber = (resolved: ChannelResolved) => void;

const subscribers = new Set<Subscriber>();
let lastResolved: ChannelResolved | null = null;

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
    if (!channelId) return;

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

/** Stop the pipeline (mainly for tests / hot-reload). */
export function teardown(): void {
  observer?.teardown();
  observer = null;
}

// Auto-start only inside a real extension content-script context (where
// `chrome.runtime.id` exists). Guarded so importing this module in unit tests
// has no side effects.
if (typeof chrome !== "undefined" && chrome.runtime?.id) {
  try {
    bootstrap();
  } catch (err) {
    console.debug("[channelwatch] content bootstrap failed", err);
  }
}
