import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  BADGE_LABELS,
  CORRECTION_CTA,
  EDITORIAL_DISCLAIMER,
  CHAIN_COPY,
  PANEL_COPY,
  POPUP_COPY,
  UNRESEARCHED_SUMMARY,
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

describe("Popup — ownership box", () => {
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

  it("renders label, summary, owners, chain, history, disclaimer, and a correction link", async () => {
    await mount(makeDeps({ lookup: async () => ({ ok: true, cached: false, payload }) }));
    const text = container.textContent ?? "";

    expect(text).toContain("Little Baby Bum");
    // Reviewed label from the copy module, never free text.
    expect(text).toContain(BADGE_LABELS.PE_BACKED);
    expect(text).toContain(payload.classification.summary);
    expect(text).toContain("Moonbug Entertainment");
    expect(text).toContain("Blackstone Inc.");
    // Chain + history section headings (from CHAIN_COPY).
    expect(text).toContain(CHAIN_COPY.heading);
    expect(text).toContain(CHAIN_COPY.historyHeading);
    // Standing disclaimer, verbatim.
    expect(text).toContain(EDITORIAL_DISCLAIMER);

    // Correction affordance is a link (not a form) to the public correction page.
    const link = container.querySelector("a.cw-popup__correction") as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link!.textContent).toBe(CORRECTION_CTA);
    expect(link!.getAttribute("href")).toContain(`channel=${CHANNEL}`);
  });

  it("invokes openCorrection with the channel id when the link is clicked", async () => {
    const openCorrection = vi.fn();
    await mount(
      makeDeps({ lookup: async () => ({ ok: true, cached: false, payload }), openCorrection }),
    );
    const link = container.querySelector("a.cw-popup__correction") as HTMLAnchorElement;
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
