import { afterEach, describe, expect, it } from "vitest";
import { EDITORIAL_DISCLAIMER, type Source } from "@channelwatch/schemas";
import { EvidenceCard } from "../../src/components/EvidenceCard.js";
import { render, type Rendered } from "../render.js";

let view: Rendered | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
});

function source(overrides: Partial<Source> = {}): Source {
  return {
    id: "s1",
    url: "https://example.com/filing",
    title: "Example regulatory filing",
    tier: 1,
    status: "ACTIVE",
    archive_url: "https://web.archive.org/web/2024/https://example.com/filing",
    ...overrides,
  };
}

describe("EvidenceCard", () => {
  it("renders the title as a link to the source and shows tier + status", () => {
    view = render(<EvidenceCard source={source()} />);
    const link = view.container.querySelector(".cw-evidence__title a") as HTMLAnchorElement;
    expect(link.textContent).toBe("Example regulatory filing");
    expect(link.getAttribute("href")).toBe("https://example.com/filing");
    const text = view.container.textContent ?? "";
    expect(text).toContain("Tier 1");
    expect(text).toContain("ACTIVE");
    expect(view.container.querySelector('a[href*="web.archive.org"]')).not.toBeNull();
  });

  it("includes the verbatim editorial disclaimer wherever evidence is shown", () => {
    view = render(<EvidenceCard source={source()} />);
    expect(view.container.textContent ?? "").toContain(EDITORIAL_DISCLAIMER);
  });

  it("falls back to the URL when there is no title, and omits ungraded tier/status", () => {
    view = render(
      <EvidenceCard
        source={source({ title: null, tier: null, status: null, archive_url: null })}
      />,
    );
    const link = view.container.querySelector(".cw-evidence__title a") as HTMLAnchorElement;
    expect(link.textContent).toBe("https://example.com/filing");
    const text = view.container.textContent ?? "";
    expect(text).not.toContain("Tier");
    expect(text).not.toContain("Status");
    // disclaimer still present
    expect(text).toContain(EDITORIAL_DISCLAIMER);
  });
});
