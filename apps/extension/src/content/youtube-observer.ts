/**
 * YouTube SPA observer. YouTube never does full page loads — it swaps content
 * client-side and fires a `yt-navigate-finish` event when a route change
 * settles, and mutates the DOM asynchronously as renderers hydrate. This module
 * coalesces both signals into a single debounced callback so the content script
 * re-resolves the channel exactly once per settled navigation, and tears down
 * cleanly (no lingering listeners, no duplicate work) on demand.
 *
 * The observer only SIGNALS; deciding what to (re)render — and avoiding
 * duplicate badges — is the consumer's job (Task 5). Everything here is wrapped
 * so a throwing callback can never escape into the page (CLAUDE.md: fail-silent).
 */
export interface ObserverOptions {
  /** Called (debounced) on start, on `yt-navigate-finish`, and on DOM mutation. */
  onNavigate: () => void;
  /** Debounce window in ms; a burst of signals collapses to one call. */
  debounceMs?: number;
  /** Document to observe; defaults to the ambient `document`. */
  target?: Document;
}

export interface ObserverHandle {
  /** Detach listeners, disconnect the MutationObserver, cancel pending calls. Idempotent. */
  teardown(): void;
}

const NAVIGATE_EVENT = "yt-navigate-finish";

export function startYouTubeObserver(options: ObserverOptions): ObserverHandle {
  const { onNavigate, debounceMs = 250 } = options;
  const doc = options.target ?? document;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let torndown = false;

  const fire = (): void => {
    timer = null;
    try {
      onNavigate();
    } catch (err) {
      // Fail silently — a consumer bug must never break YouTube.
      console.debug("[channelwatch] observer callback threw", err);
    }
  };

  const schedule = (): void => {
    if (torndown) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(fire, debounceMs);
  };

  const onNavigateEvent = (): void => schedule();

  const mutationObserver = new MutationObserver(() => schedule());

  try {
    doc.addEventListener(NAVIGATE_EVENT, onNavigateEvent);
    if (doc.body) {
      mutationObserver.observe(doc.body, { childList: true, subtree: true });
    }
    // Initial resolution for the page we loaded into.
    schedule();
  } catch (err) {
    console.debug("[channelwatch] observer start failed", err);
  }

  return {
    teardown(): void {
      if (torndown) return;
      torndown = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      try {
        doc.removeEventListener(NAVIGATE_EVENT, onNavigateEvent);
        mutationObserver.disconnect();
      } catch (err) {
        console.debug("[channelwatch] observer teardown failed", err);
      }
    },
  };
}
