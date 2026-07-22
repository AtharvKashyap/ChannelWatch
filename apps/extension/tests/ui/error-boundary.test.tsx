import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FailSilentBoundary } from "../../src/content/error-boundary.js";

let container: HTMLElement;
let root: Root;

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function Boom(): React.ReactElement {
  throw new Error("render blew up");
}

describe("FailSilentBoundary", () => {
  it("swallows a child render error and renders nothing (never breaks the page)", () => {
    // React logs caught errors to console.error; silence it for a clean run.
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});

    container = document.createElement("div");
    document.body.appendChild(container);

    expect(() => {
      act(() => {
        root = createRoot(container);
        root.render(
          <FailSilentBoundary>
            <Boom />
          </FailSilentBoundary>,
        );
      });
    }).not.toThrow();

    expect(container.textContent).toBe("");
    expect(console.debug).toHaveBeenCalled();
  });

  it("renders children normally when they do not throw", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    act(() => {
      root = createRoot(container);
      root.render(
        <FailSilentBoundary>
          <p>ok</p>
        </FailSilentBoundary>,
      );
    });
    expect(container.textContent).toBe("ok");
  });
});
