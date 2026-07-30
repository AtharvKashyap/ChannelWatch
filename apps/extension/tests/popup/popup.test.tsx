import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  CONFIDENCE_LABEL_TEXT,
  CREATOR_STATUS_TEXT,
  CORRECTION_CTA,
  EDITORIAL_DISCLAIMER,
  CHAIN_COPY,
  PANEL_COPY,
  POPUP_COPY,
  UNRESEARCHED_SUMMARY,
  VERDICT_SENTENCE,
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

  it("shows the not-researched record for an unresearched channel", async () => {
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

describe("Popup — masthead", () => {
  it("shows the CHANNELWATCH · ownership record masthead on the loading state", async () => {
    const d = deferred<LookupChannelResponse>();
    await mount(makeDeps({ lookup: () => d.promise, slowAfterMs: 10_000 }));
    const masthead = container.querySelector(".cw-masthead")?.textContent ?? "";
    expect(masthead).toContain(POPUP_COPY.title);
    expect(masthead).toContain(POPUP_COPY.recordType);
    expect(container.textContent).toContain(POPUP_COPY.loading);
    // A single hairline rule under the masthead is the only structural device.
    expect(container.querySelector(".cw-rule")).not.toBeNull();
    await act(async () => {
      d.resolve({ ok: false, error: "late" });
      await Promise.resolve();
    });
  });
});

describe("Popup — ownership record", () => {
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
    last_reviewed_at: "2026-04-15",
    ownership_chain: [
      {
        name: "Moonbug Entertainment",
        type: "COMPANY",
        relationship: "ACQUIRED",
        ownership_percentage: null,
        control_level: "CONTROLLING",
        effective_from: "2023-04-01",
      },
    ],
    ownership_history: [
      {
        name: "Moonbug Entertainment",
        type: "COMPANY",
        relationship: "ACQUIRED",
        control_level: "CONTROLLING",
        ownership_percentage: null,
        effective_from: "2021-01-01",
        effective_to: null,
        is_current: true,
      },
    ],
    warnings: ["OWNERSHIP_CHANGED_RECENTLY"],
  });

  it("renders the serif channel headline, verdict sentence, and summary with a naming aria-label", async () => {
    await mount(makeDeps({ lookup: async () => ({ ok: true, cached: false, payload }) }));

    const head = container.querySelector(".cw-head") as HTMLElement | null;
    expect(head).not.toBeNull();
    // Channel name is the headline (accent-underlined span inside the h1).
    expect(head!.querySelector(".cw-channel__name")?.textContent).toBe("Little Baby Bum");
    // The classification is a plain verdict SENTENCE, not a chip/stamp.
    expect(head!.querySelector(".cw-verdict")?.textContent).toBe(VERDICT_SENTENCE.PE_BACKED);
    expect(head!.textContent).toContain(payload.classification.summary);
    // The verdict is announced via the reviewed name-aware aria-label (names the PE firm).
    expect(head!.getAttribute("aria-label")).toBe(badgeAriaLabel("PE_BACKED", "Blackstone Inc."));
    // PE = ORANGE drives the accent; never RED.
    expect(container.querySelector('.cw-doc[data-cw-color="ORANGE"]')).not.toBeNull();
  });

  it("renders the Ownership list: owner name, mono meta, ultimate owner flagged inline", async () => {
    await mount(makeDeps({ lookup: async () => ({ ok: true, cached: false, payload }) }));

    expect(container.textContent).toContain(PANEL_COPY.panelTitle);
    const entries = Array.from(container.querySelectorAll(".cw-section .cw-entry"));
    const owner = entries[0]!;
    expect(owner.querySelector(".cw-entry__name")?.textContent).toContain("Moonbug Entertainment");
    // The top of the chain is flagged inline "— ultimate owner".
    expect(owner.querySelector(".cw-entry__flag")?.textContent).toContain(CHAIN_COPY.ultimateTag);
    // Mono meta: mechanism + humanized "since Apr 2023".
    const meta = owner.querySelector(".cw-entry__meta")?.textContent ?? "";
    expect(meta).toContain("acquired");
    expect(meta).toContain(`${CHAIN_COPY.effectiveFromPrefix} Apr 2023`);
  });

  it("renders the Over time history with humanized ranges", async () => {
    await mount(makeDeps({ lookup: async () => ({ ok: true, cached: false, payload }) }));
    const text = container.textContent ?? "";
    expect(text).toContain(CHAIN_COPY.overTimeHeading);
    // Current period rendered as "current · 2021–now" (open end → present label).
    expect(text).toContain(CHAIN_COPY.currentLabel);
    expect(text).toContain(`2021${CHAIN_COPY.dateRangeSeparator}${CHAIN_COPY.presentLabel}`);
  });

  it("renders the quiet mono facts line (confidence · evidence · creator status · reviewed)", async () => {
    await mount(makeDeps({ lookup: async () => ({ ok: true, cached: false, payload }) }));
    const facts = container.querySelector(".cw-facts")?.textContent ?? "";
    expect(facts).toContain(CONFIDENCE_LABEL_TEXT.CONFIRMED);
    expect(facts).toContain(evidenceCountText(3));
    expect(facts).toContain(CREATOR_STATUS_TEXT.CORPORATE_BRAND);
    // Last-reviewed date humanized to "Mon YYYY".
    expect(facts).toContain("Apr 2026");
  });

  it("renders the disclaimer and an understated correction link", async () => {
    await mount(makeDeps({ lookup: async () => ({ ok: true, cached: false, payload }) }));
    const text = container.textContent ?? "";
    expect(text).toContain(EDITORIAL_DISCLAIMER);

    const link = container.querySelector("a.cw-report") as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link!.textContent).toContain(CORRECTION_CTA);
    expect(link!.getAttribute("href")).toContain(`channel=${CHANNEL}`);
  });

  it("invokes openCorrection with the channel id when the link is clicked", async () => {
    const openCorrection = vi.fn();
    await mount(
      makeDeps({ lookup: async () => ({ ok: true, cached: false, payload }), openCorrection }),
    );
    const link = container.querySelector("a.cw-report") as HTMLAnchorElement;
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
