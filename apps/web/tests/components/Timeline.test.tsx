import { afterEach, describe, expect, it } from "vitest";
import { Timeline, type TimelineEntry } from "../../src/components/Timeline.js";
import { render, type Rendered } from "../render.js";

let view: Rendered | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
});

const ENTRIES: TimelineEntry[] = [
  { date: "2021-11-04", label: "Acquired by Example Media Group", detail: "controlling stake" },
  { date: null, label: "Channel founded" },
];

describe("Timeline", () => {
  it("renders one list item per entry, in the order given", () => {
    view = render(<Timeline entries={ENTRIES} />);
    const items = view.container.querySelectorAll("ol.cw-timeline > li");
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toContain("Acquired by Example Media Group");
    expect(items[0]!.textContent).toContain("controlling stake");
    expect(items[1]!.textContent).toContain("Channel founded");
  });

  it("renders the date in a <time> element with a machine-readable dateTime", () => {
    view = render(<Timeline entries={[ENTRIES[0]!]} />);
    const time = view.container.querySelector("time") as HTMLTimeElement;
    expect(time.getAttribute("datetime")).toBe("2021-11-04");
    expect(time.textContent).toBe("2021-11-04");
  });

  it("shows the undated fallback for a null date and omits its dateTime", () => {
    view = render(<Timeline entries={[{ date: null, label: "x" }]} undatedLabel="Date unknown" />);
    const time = view.container.querySelector("time") as HTMLTimeElement;
    expect(time.textContent).toBe("Date unknown");
    expect(time.hasAttribute("datetime")).toBe(false);
  });

  it("renders nothing when there are no entries", () => {
    view = render(<Timeline entries={[]} />);
    expect(view.container.querySelector("ol.cw-timeline")).toBeNull();
  });
});
