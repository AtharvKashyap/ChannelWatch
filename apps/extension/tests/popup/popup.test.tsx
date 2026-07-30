import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  BADGE_LABELS,
  CONFIDENCE_LABEL_TEXT,
  CREATOR_STATUS_TEXT,
  CORRECTION_CTA,
  EDITORIAL_DISCLAIMER,
  CHAIN_COPY,
  PANEL_COPY,
  POPUP_COPY,
  UNRESEARCHED_SUMMARY,
  badgeAriaLabel,
  evidenceCountText,
} from "@channelwatch/schemas";
import { Popup, type PopupDeps } from "../../src/popup/Popup.js";
import { researchedFixture } from "../fixtures.js";
import type { LookupChannelResponse } from "../../src/shared/messages.js";

let container: HTMLElement;
let root: Root;
let mounted = false;

const WATCH_URL = "https://www.youtube.com/watch?v=abc123";
const CHANNEL = "UCHnyfMqiRRG1u-2MsSQLbXA";

/** Base deps: watch page, resolves a channel, lookup provided per test. */
function makeDeps(over: Partial<PopupDeps> = {}): PopupDeps {
  return {
    getActiveTabUrl: async () => WATCH_URL,
    resolveChannel: async () => CHANNEL,
    lookup: async (): Promise<LookupChannelResponse> => ({ ok: false, error: "unset" }),
    openCorrection: () => {},
    ...over,
  };
}

async function mount(deps: PopupDeps) {
  container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container);
    root.render(<Popup deps={deps} />);
  });
  // Flush the async load chain (getActiveTabUrl → resolveChannel → lookup).
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  mounted = true;
}

function unmount() {
  if (!mounted) return;
  act(() => root.unmount());
  container.remove();
  mounted = false;
}

afterEach(() => {
  unmount();
  vi.restoreAllMocks();
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("Popup — non-watch fallback", () => {
  it("shows the friendly prompt on the homepage", async () => {
    await mount(makeDeps({ getActiveTabUrl: async () => "https://www.youtube.com/" }));
    expect(container.textContent).toContain(POPUP_COPY.notWatchPage);
  });

  it("shows the friendly prompt on a non-YouTube tab", async () => {
    await mount(makeDeps({ getActiveTabUrl: async () => "https://example.com/watch" }));
    expect(container.textContent).toContain(POPUP_COPY.notWatchPage);
  });

  it("shows the friendly prompt on a channel page (watch-only scope)", async () => {
    await mount(makeDeps({ getActiveTabUrl: async () => "https://www.youtube.com/@veritasium" }));
    expect(container.textContent).toContain(POPUP_COPY.notWatchPage);
  });
});

describe("Popup — resolution + lookup states", () => {
  it("shows the unresolved message when the channel cannot be read", async () => {
    await mount(makeDeps({ resolveChannel: async () => null }));
    expect(container.textContent).toContain(POPUP_COPY.channelUnresolved);
  });

  it("shows the error message when the lookup fails", async () => {
    await mount(makeDeps({ lookup: async () => ({ ok: false, error: "boom" }) }));
    expect(container.textContent).toContain(POPUP_COPY.lookupError);
  });

  it("shows the not-researched box for an unresearched channel", async () => {
    await mount(
      makeDeps({
        lookup: async () => ({
          ok: true,
          cached: false,
          payload: {
            youtube_channel_id: CHANNEL,
            researched: false,
            research_status: "UNRESEARCHED",
            summary: UNRESEARCHED_SUMMARY,
            disclaimer: EDITORIAL_DISCLAIMER,
          },
        }),
      }),
    );
    expect(container.textContent).toContain(PANEL_COPY.unresearchedHeading);
    expect(container.textContent).toContain(UNRESEARCHED_SUMMARY);
    expect(container.textContent).toContain(EDITORIAL_DISCLAIMER);
  });
});

describe("Popup — wordmark eyebrow", () => {
  it("shows the CHANNELWATCH wordmark on the loading state", async () => {
    const d = deferred<LookupChannelResponse>();
    await mount(makeDeps({ lookup: () => d.promise, slowAfterMs: 10_000 }));
    expect(container.querySelector(".cw-wordmark")?.textContent).toBe(POPUP_COPY.title);
    expect(container.textContent).toContain(POPUP_COPY.loading);
    await act(async () => {
      d.resolve({ ok: false, error: "late" });
      await Promise.resolve();
    });
  });
});

describe("Popup — ownership dossier", () => {
  const payload = researchedFixture({
    display_name: "Little Baby Bum",
    classification: {
      label: "PE_BACKED",
      confidence: 0.95,
      confidence_label: "CONFIRMED",
      summary: "Public records indicate that Moonbug Entertainment owns Little Baby Bum.",
    },
    badge_color: "ORANGE",
    direct_owner: { id: "ent-moonbug", name: "Moonbug Entertainment", type: "COMPANY" },
    ultimate_parent: { id: "ent-blackstone", name: "Blackstone Inc.", type: "PRIVATE_EQUITY_FIRM" },
    creator_status: { status: "CORPORATE_BRAND", ownership_stake: "n/a" },
    evidence_count: 3,
    ownership_chain: [
      {
        name: "Moonbug Entertainment",
        type: "COMPANY",
        relationship: "ACQUIRED",
        ownership_percentage: null,
        control_level: "CONTROLLING",
        effective_from: "2018",
      },
    ],
    ownership_history: [
      {
        name: "Moonbug Entertainment",
        type: "COMPANY",
        relationship: "ACQUIRED",
        control_level: "CONTROLLING",
        ownership_percentage: null,
        effective_from: "2018",
        effective_to: null,
        is_current: true,
      },
    ],
    warnings: ["OWNERSHIP_CHANGED_RECENTLY"],
  });

  it("renders the verdict band: channel name, uppercase stamp, summary, and an aria-label", async () => {
    await mount(makeDeps({ lookup: async () => ({ ok: true, cached: false, payload }) }));

    const verdict = container.querySelector(".cw-verdict") as HTMLElement | null;
    expect(verdict).not.toBeNull();
    // Channel name + the reviewed verdict stamp live inside the verdict band.
    expect(verdict!.querySelector(".cw-verdict__channel")?.textContent).toBe("Little Baby Bum");
    expect(verdict!.querySelector(".cw-verdict__stamp")?.textContent).toBe(BADGE_LABELS.PE_BACKED);
    expect(verdict!.textContent).toContain(payload.classification.summary);
    // The verdict is announced via the reviewed name-aware aria-label (names the PE firm).
    expect(verdict!.getAttribute("aria-label")).toBe(
      badgeAriaLabel("PE_BACKED", "Blackstone Inc."),
    );
    // Verdict color drives the card accent (PE = ORANGE, never RED).
    expect(container.querySelector('.cw-card[data-cw-color="ORANGE"]')).not.toBeNull();
  });

  it("renders the ownership-lineage rail: ultimate owner at top, channel pinned at the base", async () => {
    await mount(makeDeps({ lookup: async () => ({ ok: true, cached: false, payload }) }));

    expect(container.textContent).toContain(CHAIN_COPY.lineageHeading);
    const nodes = Array.from(container.querySelectorAll(".cw-rail__node"));
    // Two nodes: the ultimate owner (from the chain) + the channel base node.
    expect(nodes.length).toBe(2);

    // Top node = the ultimate owner, tagged as such, with the mono mechanism meta.
    const top = nodes[0]!;
    expect(top.querySelector(".cw-rail__name")?.textContent).toContain("Moonbug Entertainment");
    expect(top.querySelector(".cw-rail__tag")?.textContent).toBe(CHAIN_COPY.ultimateTag);
    expect(top.querySelector(".cw-rail__meta")?.textContent).toContain("acquired");

    // Base node = the channel itself, pinned last, glyphed and tagged "this channel".
    const base = nodes[nodes.length - 1]!;
    expect(base.getAttribute("data-cw-channel")).toBe("true");
    expect(base.querySelector(".cw-rail__name")?.textContent).toContain("Little Baby Bum");
    expect(base.querySelector(".cw-rail__name")?.textContent).toContain("▶");
    expect(base.querySelector(".cw-rail__tag")?.textContent).toBe(CHAIN_COPY.thisChannelTag);
  });

  it("renders the compact mono meta row (confidence · evidence · creator status)", async () => {
    await mount(makeDeps({ lookup: async () => ({ ok: true, cached: false, payload }) }));
    const meta = container.querySelector(".cw-meta")?.textContent ?? "";
    expect(meta).toContain(CONFIDENCE_LABEL_TEXT.CONFIRMED);
    expect(meta).toContain(evidenceCountText(3));
    expect(meta).toContain(CREATOR_STATUS_TEXT.CORPORATE_BRAND);
  });

  it("renders the history section, disclaimer, and a correction link", async () => {
    await mount(makeDeps({ lookup: async () => ({ ok: true, cached: false, payload }) }));
    const text = container.textContent ?? "";

    // History ("over time") section heading + entry.
    expect(text).toContain(CHAIN_COPY.historyHeading);
    expect(container.querySelector(".cw-history__period")).not.toBeNull();
    // Standing disclaimer, verbatim.
    expect(text).toContain(EDITORIAL_DISCLAIMER);

    // Correction affordance is a link (not a form) to the public correction page.
    const link = container.querySelector("a.cw-correction") as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link!.textContent).toBe(CORRECTION_CTA);
    expect(link!.getAttribute("href")).toContain(`channel=${CHANNEL}`);
  });

  it("invokes openCorrection with the channel id when the link is clicked", async () => {
    const openCorrection = vi.fn();
    await mount(
      makeDeps({ lookup: async () => ({ ok: true, cached: false, payload }), openCorrection }),
    );
    const link = container.querySelector("a.cw-correction") as HTMLAnchorElement;
    act(() => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(openCorrection).toHaveBeenCalledWith(CHANNEL);
  });
});

describe("Popup — cold-start slow state", () => {
  it("shows the slow message while a lookup stays pending past the threshold", async () => {
    const d = deferred<LookupChannelResponse>();
    await mount(makeDeps({ lookup: () => d.promise, slowAfterMs: 10 }));

    // Still loading right after the resolve chain.
    expect(container.textContent).toContain(POPUP_COPY.loading);

    // Let the slow timer fire.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 25));
    });
    expect(container.textContent).toContain(POPUP_COPY.slowLoading);

    // Resolve to avoid a dangling promise.
    await act(async () => {
      d.resolve({ ok: false, error: "late" });
      await Promise.resolve();
    });
  });
});
