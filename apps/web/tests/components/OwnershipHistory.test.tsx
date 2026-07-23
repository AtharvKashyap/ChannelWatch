import { afterEach, describe, expect, it } from "vitest";
import { CHAIN_COPY, type OwnershipHistoryEntry } from "@channelwatch/schemas";
import { OwnershipHistory, dateRangeText } from "../../src/components/OwnershipHistory.js";
import { render, type Rendered } from "../render.js";

let view: Rendered | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
});

function entry(overrides: Partial<OwnershipHistoryEntry> = {}): OwnershipHistoryEntry {
  return {
    name: "Candle Media",
    type: "COMPANY",
    relationship: "OWNS",
    control_level: "CONTROLLING",
    ownership_percentage: 75,
    effective_from: "2021-11-04",
    effective_to: null,
    is_current: true,
    ...overrides,
  };
}

describe("OwnershipHistory", () => {
  it("renders the section heading and one <li> per period, in the order given", () => {
    view = render(
      <OwnershipHistory
        entries={[
          entry({ name: "Candle Media", is_current: true }),
          entry({
            name: "Mythical Entertainment",
            relationship: "FORMERLY_OWNED_BY",
            ownership_percentage: null,
            effective_from: "2019-02-22",
            effective_to: "2021-11-04",
            is_current: false,
          }),
        ]}
      />,
    );
    const text = view.container.textContent ?? "";
    expect(text).toContain(CHAIN_COPY.historyHeading);
    const items = view.container.querySelectorAll("ol.cw-history__list > li");
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toContain("Candle Media");
    expect(items[1]!.textContent).toContain("Mythical Entertainment");
  });

  it("marks the current period and marks prior periods 'previously'", () => {
    view = render(
      <OwnershipHistory
        entries={[
          entry({ is_current: true }),
          entry({ name: "Prior Co", is_current: false, effective_to: "2021-11-04" }),
        ]}
      />,
    );
    const items = view.container.querySelectorAll("li.cw-history__period");
    expect(items[0]!.textContent).toContain(CHAIN_COPY.currentLabel);
    expect(items[0]!.getAttribute("data-cw-current")).toBe("true");
    expect(items[1]!.textContent).toContain(CHAIN_COPY.previouslyPrefix);
    expect(items[1]!.getAttribute("data-cw-current")).toBe("false");
  });

  it("shows a documented from–to range, an open-ended current period, and the not-disclosed fallback", () => {
    view = render(
      <OwnershipHistory
        entries={[
          // open-ended current: "2021-11-04 – current"
          entry({ effective_from: "2021-11-04", effective_to: null, is_current: true }),
          // closed prior range: "2019-02-22 – 2021-11-04"
          entry({
            name: "Prior Co",
            effective_from: "2019-02-22",
            effective_to: "2021-11-04",
            is_current: false,
          }),
          // both dates undocumented → the honest fallback
          entry({
            name: "Undated Co",
            effective_from: null,
            effective_to: null,
            is_current: false,
          }),
        ]}
      />,
    );
    const text = view.container.textContent ?? "";
    expect(text).toContain(
      `2021-11-04 ${CHAIN_COPY.dateRangeSeparator} ${CHAIN_COPY.currentLabel}`,
    );
    expect(text).toContain(`2019-02-22 ${CHAIN_COPY.dateRangeSeparator} 2021-11-04`);
    expect(text).toContain(CHAIN_COPY.dateUndisclosed);
  });

  it("shows the exact percentage when disclosed and the not-disclosed line otherwise", () => {
    view = render(
      <OwnershipHistory
        entries={[
          entry({ ownership_percentage: 75 }),
          entry({ name: "Prior Co", ownership_percentage: null, is_current: false }),
        ]}
      />,
    );
    const text = view.container.textContent ?? "";
    expect(text).toContain("75% stake");
    expect(text).toContain("stake not publicly disclosed");
  });

  it("renders nothing when there are no entries", () => {
    view = render(<OwnershipHistory entries={[]} />);
    expect(view.container.querySelector("ol.cw-history__list")).toBeNull();
    expect(view.container.textContent ?? "").not.toContain(CHAIN_COPY.historyHeading);
  });
});

describe("dateRangeText (unit)", () => {
  it("returns the fallback when both dates are undocumented", () => {
    expect(
      dateRangeText(entry({ effective_from: null, effective_to: null, is_current: false })),
    ).toBe(CHAIN_COPY.dateUndisclosed);
  });

  it("uses 'current' as the open end of a current, open-ended period", () => {
    expect(dateRangeText(entry({ effective_from: "2021-11-04", effective_to: null }))).toBe(
      `2021-11-04 ${CHAIN_COPY.dateRangeSeparator} ${CHAIN_COPY.currentLabel}`,
    );
  });

  it("shows just the from date for a non-current period with no end date", () => {
    expect(
      dateRangeText(entry({ effective_from: "2019-02-22", effective_to: null, is_current: false })),
    ).toBe("2019-02-22");
  });
});
