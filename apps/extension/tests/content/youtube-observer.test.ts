import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startYouTubeObserver } from "../../src/content/youtube-observer.js";

describe("startYouTubeObserver", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("invokes the callback once on start (debounced)", () => {
    const onNavigate = vi.fn();
    const handle = startYouTubeObserver({ onNavigate, debounceMs: 50 });
    expect(onNavigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    handle.teardown();
  });

  it("re-resolves on yt-navigate-finish (SPA navigation)", () => {
    const onNavigate = vi.fn();
    const handle = startYouTubeObserver({ onNavigate, debounceMs: 50 });
    vi.advanceTimersByTime(50);
    onNavigate.mockClear();

    document.dispatchEvent(new Event("yt-navigate-finish"));
    vi.advanceTimersByTime(50);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    handle.teardown();
  });

  it("debounces a burst of events and mutations into a single call", () => {
    const onNavigate = vi.fn();
    const handle = startYouTubeObserver({ onNavigate, debounceMs: 50 });
    vi.advanceTimersByTime(50);
    onNavigate.mockClear();

    document.dispatchEvent(new Event("yt-navigate-finish"));
    document.dispatchEvent(new Event("yt-navigate-finish"));
    const el = document.createElement("div");
    document.body.appendChild(el); // mutation
    document.body.appendChild(document.createElement("span"));
    vi.advanceTimersByTime(50);

    expect(onNavigate).toHaveBeenCalledTimes(1);
    handle.teardown();
  });

  it("stops firing after teardown", () => {
    const onNavigate = vi.fn();
    const handle = startYouTubeObserver({ onNavigate, debounceMs: 50 });
    vi.advanceTimersByTime(50);
    onNavigate.mockClear();

    handle.teardown();
    document.dispatchEvent(new Event("yt-navigate-finish"));
    document.body.appendChild(document.createElement("div"));
    vi.advanceTimersByTime(200);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("teardown is idempotent (safe to call twice)", () => {
    const onNavigate = vi.fn();
    const handle = startYouTubeObserver({ onNavigate, debounceMs: 50 });
    vi.advanceTimersByTime(50);
    expect(() => {
      handle.teardown();
      handle.teardown();
    }).not.toThrow();
  });

  it("a callback that throws never escapes the observer", () => {
    const onNavigate = vi.fn(() => {
      throw new Error("boom");
    });
    const handle = startYouTubeObserver({ onNavigate, debounceMs: 50 });
    expect(() => vi.advanceTimersByTime(50)).not.toThrow();
    handle.teardown();
  });
});
