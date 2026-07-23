import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import {
  CORRECTION_PAGE_COPY,
  CORRECTION_RECEIVED,
  PANEL_COPY,
  type CorrectionSubmission,
} from "@channelwatch/schemas";
import { CorrectionForm } from "../../src/components/CorrectionForm.js";
import type { ApiResult, SubmissionReceipt } from "../../src/lib/api-client.js";
import { render, type Rendered } from "../render.js";

let view: Rendered | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
  vi.restoreAllMocks();
});

const VALID_ID = "UCHnyfMqiRRG1u-2MsSQLbXA";
const LONG_ENOUGH = "The owner listed here was acquired last year and is now out of date.";
const ok = async (): Promise<ApiResult<SubmissionReceipt>> => ({
  ok: true,
  data: { message: CORRECTION_RECEIVED },
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

function fields() {
  const inputs = view!.container.querySelectorAll<HTMLInputElement>('input[type="text"]');
  return {
    channelId: inputs[0]!,
    explanation: view!.container.querySelector("textarea")!,
  };
}

function submit() {
  const btn = [...view!.container.querySelectorAll("button")].find(
    (b) => b.textContent === PANEL_COPY.submit,
  )!;
  act(() => btn.click());
}

async function submitAsync() {
  await act(async () => {
    [...view!.container.querySelectorAll("button")]
      .find((b) => b.textContent === PANEL_COPY.submit)!
      .click();
    await Promise.resolve();
  });
}

describe("CorrectionForm — validation", () => {
  it("rejects an invalid channel ID and does not call the submit handler", () => {
    const onSubmit = vi.fn(ok);
    view = render(<CorrectionForm onSubmit={onSubmit} />);
    setValue(fields().channelId, "not-a-channel");
    setValue(fields().explanation, LONG_ENOUGH);
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain(CORRECTION_PAGE_COPY.channelIdInvalid);
  });

  it("blocks a too-short explanation and does not call the submit handler", () => {
    const onSubmit = vi.fn(ok);
    view = render(<CorrectionForm onSubmit={onSubmit} />);
    setValue(fields().channelId, VALID_ID);
    setValue(fields().explanation, "too short");
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain(PANEL_COPY.explanationTooShort);
  });
});

describe("CorrectionForm — submission states", () => {
  it("posts the channel id + explanation and shows the receipt on success", async () => {
    let captured: CorrectionSubmission | null = null;
    const onSubmit = vi.fn(async (s: CorrectionSubmission) => {
      captured = s;
      return { ok: true, data: { message: CORRECTION_RECEIVED } } as ApiResult<SubmissionReceipt>;
    });
    view = render(<CorrectionForm onSubmit={onSubmit} />);
    setValue(fields().channelId, VALID_ID);
    setValue(fields().explanation, LONG_ENOUGH);
    await submitAsync();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(captured).toEqual({ youtube_channel_id: VALID_ID, explanation: LONG_ENOUGH });
    expect(view.container.textContent).toContain(CORRECTION_RECEIVED);
  });

  it("shows an error message when the submit handler reports failure", async () => {
    const onSubmit = vi.fn(
      async () => ({ ok: false, message: "boom" }) as ApiResult<SubmissionReceipt>,
    );
    view = render(<CorrectionForm onSubmit={onSubmit} />);
    setValue(fields().channelId, VALID_ID);
    setValue(fields().explanation, LONG_ENOUGH);
    await submitAsync();
    expect(view.container.textContent).toContain(PANEL_COPY.submitError);
  });

  it("prefills the channel ID when given", () => {
    view = render(<CorrectionForm initialChannelId={VALID_ID} onSubmit={vi.fn(ok)} />);
    expect(fields().channelId.value).toBe(VALID_ID);
  });
});
