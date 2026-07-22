import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  BADGE_LABELS,
  EDITORIAL_DISCLAIMER,
  CONFIDENCE_LABEL_TEXT,
  CREATOR_STATUS_TEXT,
  EXPLANATION_TEXT,
  PANEL_COPY,
  CORRECTION_RECEIVED,
  evidenceCountText,
  type CorrectionSubmission,
} from "@channelwatch/schemas";
import { OwnershipPanel } from "../../src/content/ownership-panel.js";
import { researchedFixture } from "../fixtures.js";
import type { SubmitCorrectionResponse } from "../../src/shared/messages.js";

let container: HTMLElement;
let root: Root;

function mount(node: React.ReactElement) {
  container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(node);
  });
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const noopSubmit = async (): Promise<SubmitCorrectionResponse> => ({ ok: true });

describe("OwnershipPanel — display", () => {
  it("shows the classification label, summary, and verbatim disclaimer", () => {
    mount(
      <OwnershipPanel
        payload={researchedFixture({
          classification: {
            label: "PE_BACKED",
            confidence: 0.95,
            confidence_label: "CONFIRMED",
            summary: "Public records indicate that Acme owns Example.",
          },
          badge_color: "ORANGE",
        })}
        onClose={() => {}}
        onSubmitCorrection={noopSubmit}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain(BADGE_LABELS.PE_BACKED);
    expect(text).toContain("Public records indicate that Acme owns Example.");
    expect(text).toContain(EDITORIAL_DISCLAIMER);
    expect(text).toContain(CONFIDENCE_LABEL_TEXT.CONFIRMED);
    expect(text).toContain(evidenceCountText(0));
    expect(text).toContain("2026-01-01"); // last reviewed
  });

  it("shows owners, creator status, and warnings when present; omits them when absent", () => {
    mount(
      <OwnershipPanel
        payload={researchedFixture({
          direct_owner: { id: "e1", name: "Acme Media LLC", type: "COMPANY" },
          ultimate_parent: { id: "e2", name: "Big Capital", type: "PRIVATE_EQUITY_FIRM" },
          creator_status: { status: "MINORITY_OWNER", ownership_stake: "undisclosed" },
          warnings: ["OWNERSHIP_CHANGED_RECENTLY"],
        })}
        onClose={() => {}}
        onSubmitCorrection={noopSubmit}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Acme Media LLC");
    expect(text).toContain("Big Capital");
    expect(text).toContain(CREATOR_STATUS_TEXT.MINORITY_OWNER);
    expect(text).toContain(EXPLANATION_TEXT.OWNERSHIP_CHANGED_RECENTLY);
  });

  it("does not render owner rows when owners are null", () => {
    mount(
      <OwnershipPanel
        payload={researchedFixture({
          direct_owner: null,
          ultimate_parent: null,
          creator_status: null,
        })}
        onClose={() => {}}
        onSubmitCorrection={noopSubmit}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).not.toContain(PANEL_COPY.directOwnerLabel);
    expect(text).not.toContain(PANEL_COPY.creatorStatusLabel);
  });

  it("invokes onClose when the close control is clicked", () => {
    const onClose = vi.fn();
    mount(
      <OwnershipPanel
        payload={researchedFixture()}
        onClose={onClose}
        onSubmitCorrection={noopSubmit}
      />,
    );
    const closeBtn = [...container.querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-label") === PANEL_COPY.close,
    )!;
    act(() => closeBtn.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("OwnershipPanel — correction form", () => {
  function getExplanation(): HTMLTextAreaElement {
    return container.querySelector("textarea")!;
  }
  function submit() {
    const btn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === PANEL_COPY.submit,
    )!;
    act(() => btn.click());
  }

  it("blocks a too-short explanation and does not call the submit handler", () => {
    const onSubmitCorrection = vi.fn(noopSubmit);
    mount(
      <OwnershipPanel
        payload={researchedFixture()}
        onClose={() => {}}
        onSubmitCorrection={onSubmitCorrection}
      />,
    );
    setValue(getExplanation(), "too short");
    submit();
    expect(onSubmitCorrection).not.toHaveBeenCalled();
    expect(container.textContent).toContain(PANEL_COPY.explanationTooShort);
  });

  it("submits ONLY the channel id + typed fields (privacy) and shows the receipt", async () => {
    let captured: CorrectionSubmission | null = null;
    const onSubmitCorrection = vi.fn(async (s: CorrectionSubmission) => {
      captured = s;
      return { ok: true } as SubmitCorrectionResponse;
    });
    mount(
      <OwnershipPanel
        payload={researchedFixture({ youtube_channel_id: "UCHnyfMqiRRG1u-2MsSQLbXA" })}
        onClose={() => {}}
        onSubmitCorrection={onSubmitCorrection}
      />,
    );
    setValue(
      getExplanation(),
      "The owner listed here was acquired last year and is now out of date.",
    );
    await act(async () => {
      [...container.querySelectorAll("button")]
        .find((b) => b.textContent === PANEL_COPY.submit)!
        .click();
      await Promise.resolve();
    });

    expect(onSubmitCorrection).toHaveBeenCalledTimes(1);
    expect(captured).toEqual({
      youtube_channel_id: "UCHnyfMqiRRG1u-2MsSQLbXA",
      explanation: "The owner listed here was acquired last year and is now out of date.",
    });
    // no page URL / video id / viewing context keys
    expect(Object.keys(captured!).sort()).toEqual(["explanation", "youtube_channel_id"]);
    expect(container.textContent).toContain(CORRECTION_RECEIVED);
  });

  it("shows an error message when the submit handler fails", async () => {
    const onSubmitCorrection = vi.fn(
      async () => ({ ok: false, error: "boom" }) as SubmitCorrectionResponse,
    );
    mount(
      <OwnershipPanel
        payload={researchedFixture()}
        onClose={() => {}}
        onSubmitCorrection={onSubmitCorrection}
      />,
    );
    setValue(
      getExplanation(),
      "The owner listed here was acquired last year and is now out of date.",
    );
    await act(async () => {
      [...container.querySelectorAll("button")]
        .find((b) => b.textContent === PANEL_COPY.submit)!
        .click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain(PANEL_COPY.submitError);
  });
});
