import { afterEach, describe, expect, it } from "vitest";
import { SITE_COPY, UNRESEARCHED_SUMMARY, EDITORIAL_DISCLAIMER } from "@channelwatch/schemas";
import { UnresearchedNotice } from "../../src/components/UnresearchedNotice.js";
import { render, type Rendered } from "../render.js";

let view: Rendered | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
});

describe("UnresearchedNotice", () => {
  it("renders the reviewed unresearched copy and the standing disclaimer, fabricating nothing", () => {
    view = render(<UnresearchedNotice />);
    const text = view.container.textContent ?? "";
    expect(text).toContain(SITE_COPY.unresearchedHeading);
    expect(text).toContain(UNRESEARCHED_SUMMARY);
    expect(text).toContain(EDITORIAL_DISCLAIMER);
    // no ownership assertion is fabricated
    expect(text).not.toMatch(/owns|acquired|private equity/i);
  });
});
