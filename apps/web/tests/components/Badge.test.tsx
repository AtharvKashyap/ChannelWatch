import { afterEach, describe, expect, it } from "vitest";
import {
  BADGE_LABELS,
  badgeAriaLabel,
  badgeText,
  classificationToBadgeColor,
} from "@channelwatch/schemas";
import { Badge } from "../../src/components/Badge.js";
import { render, type Rendered } from "../render.js";

let view: Rendered | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
});

describe("Badge", () => {
  it("renders the reviewed label text and derives its §9.2 color from the label", () => {
    view = render(<Badge label="INDEPENDENT" />);
    const chip = view.container.querySelector(".cw-badge")!;
    expect(chip.textContent).toBe(BADGE_LABELS.INDEPENDENT);
    // INDEPENDENT → GREEN (single source of truth in schemas).
    expect(chip.getAttribute("data-cw-color")).toBe(classificationToBadgeColor("INDEPENDENT"));
    expect(chip.getAttribute("data-cw-color")).toBe("GREEN");
  });

  it("appends the operative entity name for name-suffixed labels (PE_BACKED)", () => {
    view = render(<Badge label="PE_BACKED" name="Blackstone Inc." />);
    const chip = view.container.querySelector(".cw-badge")!;
    expect(chip.textContent).toBe(badgeText("PE_BACKED", "Blackstone Inc."));
    expect(chip.textContent).toContain(BADGE_LABELS.PE_BACKED);
    expect(chip.textContent).toContain("Blackstone Inc.");
    expect(chip.getAttribute("data-cw-color")).toBe("ORANGE"); // never RED for PE
  });

  it("does not append a name for labels that carry no name suffix (CREATOR_OWNED)", () => {
    view = render(<Badge label="CREATOR_OWNED" name="Some Person" />);
    const chip = view.container.querySelector(".cw-badge")!;
    expect(chip.textContent).toBe(BADGE_LABELS.CREATOR_OWNED);
    expect(chip.textContent).not.toContain("Some Person");
  });

  it("uses RED only for DISPUTED", () => {
    view = render(<Badge label="DISPUTED" />);
    expect(view.container.querySelector(".cw-badge")!.getAttribute("data-cw-color")).toBe("RED");
  });

  it("exposes the reviewed accessible label (announcing the full name)", () => {
    view = render(<Badge label="PE_BACKED" name="Blackstone Inc." />);
    const chip = view.container.querySelector(".cw-badge")!;
    expect(chip.getAttribute("aria-label")).toBe(badgeAriaLabel("PE_BACKED", "Blackstone Inc."));
  });
});
