import type { ReactElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * Minimal render harness mirroring the extension's component tests
 * (apps/extension/tests/ui/*.test.tsx): render a node into a detached container
 * with react-dom/client + act(...), and tear it down afterward. No extra
 * testing library — the presentational components are plain React.
 */
export interface Rendered {
  container: HTMLElement;
  unmount: () => void;
}

export function render(node: ReactElement): Rendered {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(node);
  });
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}
