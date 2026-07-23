import { afterEach, describe, expect, it } from "vitest";
import { CONFIDENCE_LABEL_TEXT } from "@channelwatch/schemas";
import { ConfidenceLabel } from "../../src/components/ConfidenceLabel.js";
import { render, type Rendered } from "../render.js";

let view: Rendered | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
});

describe("ConfidenceLabel", () => {
  it("renders the reviewed text for a score band", () => {
    view = render(<ConfidenceLabel value="HIGH" />);
    const el = view.container.querySelector(".cw-confidence")!;
    expect(el.textContent).toBe(CONFIDENCE_LABEL_TEXT.HIGH);
    expect(el.getAttribute("data-cw-confidence")).toBe("HIGH");
  });

  it("renders the conflict/absence states from the copy module too", () => {
    view = render(<ConfidenceLabel value="DISPUTED" />);
    expect(view.container.querySelector(".cw-confidence")!.textContent).toBe(
      CONFIDENCE_LABEL_TEXT.DISPUTED,
    );
    view.unmount();
    view = render(<ConfidenceLabel value="UNKNOWN" />);
    expect(view.container.querySelector(".cw-confidence")!.textContent).toBe(
      CONFIDENCE_LABEL_TEXT.UNKNOWN,
    );
  });
});
