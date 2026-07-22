import { describe, expect, it, vi } from "vitest";
import { BADGE_LABELS, badgeAriaLabel, badgeText } from "@channelwatch/schemas";
import {
  BADGE_HOST_ID,
  pageKindFromUrl,
  resolveBadgeDecision,
  renderBadge,
  removeBadge,
} from "../../src/content/badge-renderer.js";
import { DEFAULT_SETTINGS, type Settings } from "../../src/shared/settings.js";
import { researchedFixture, unresearchedFixture } from "../fixtures.js";
import type { LookupChannelResponse } from "../../src/shared/messages.js";

const WATCH_URL = "https://www.youtube.com/watch?v=x";
const CHANNEL_URL = "https://www.youtube.com/@veritasium";
const HOME_URL = "https://www.youtube.com/feed/subscriptions";

const ok = (
  payload: ReturnType<typeof researchedFixture> | ReturnType<typeof unresearchedFixture>,
): LookupChannelResponse => ({ ok: true, payload, cached: false }) as LookupChannelResponse;

function watchDoc(): Document {
  const doc = document.implementation.createHTMLDocument("watch");
  doc.body.innerHTML =
    '<ytd-video-owner-renderer><div id="channel-name">Veritasium</div></ytd-video-owner-renderer>';
  return doc;
}

function channelDoc(): Document {
  const doc = document.implementation.createHTMLDocument("channel");
  doc.body.innerHTML =
    '<yt-page-header-view-model><h1 class="page-header-view-model-wiz__page-header-title">Veritasium</h1></yt-page-header-view-model>';
  return doc;
}

function hosts(doc: Document): Element[] {
  return [...doc.querySelectorAll(`#${BADGE_HOST_ID}`)];
}

const settings = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...patch });

describe("pageKindFromUrl", () => {
  it("classifies watch / shorts / channel / other", () => {
    expect(pageKindFromUrl(WATCH_URL)).toBe("watch");
    expect(pageKindFromUrl("https://www.youtube.com/shorts/abc")).toBe("watch");
    expect(pageKindFromUrl(CHANNEL_URL)).toBe("channel");
    expect(pageKindFromUrl("https://www.youtube.com/channel/UCabc")).toBe("channel");
    expect(pageKindFromUrl(HOME_URL)).toBe("other");
  });
});

describe("resolveBadgeDecision", () => {
  it("returns label + color for a researched channel", () => {
    const d = resolveBadgeDecision(
      ok(
        researchedFixture({
          classification: {
            label: "PE_BACKED",
            confidence: 0.95,
            confidence_label: "CONFIRMED",
            summary: "s",
          },
          badge_color: "ORANGE",
        }),
      ),
      settings(),
    );
    expect(d).toEqual({ label: "PE_BACKED", color: "ORANGE" });
  });

  it("renders nothing for an UNRESEARCHED channel (default off)", () => {
    expect(resolveBadgeDecision(ok(unresearchedFixture()), settings())).toBeNull();
  });

  it("renders nothing when the lookup failed", () => {
    expect(resolveBadgeDecision(null, settings())).toBeNull();
    expect(resolveBadgeDecision({ ok: false, error: "boom" }, settings())).toBeNull();
  });

  it("onlyConfirmed suppresses non-CONFIRMED records", () => {
    const moderate = ok(
      researchedFixture({
        classification: {
          label: "CORPORATE_OWNED",
          confidence: 0.6,
          confidence_label: "MODERATE",
          summary: "s",
        },
        badge_color: "PURPLE",
      }),
    );
    expect(resolveBadgeDecision(moderate, settings({ onlyConfirmed: true }))).toBeNull();
    expect(resolveBadgeDecision(moderate, settings({ onlyConfirmed: false }))).not.toBeNull();
  });

  it("hideCreatorOwnedBadges suppresses creator-owned records", () => {
    const creator = ok(
      researchedFixture({
        classification: {
          label: "CREATOR_OWNED",
          confidence: 0.95,
          confidence_label: "CONFIRMED",
          summary: "s",
        },
        badge_color: "GREEN",
      }),
    );
    expect(resolveBadgeDecision(creator, settings({ hideCreatorOwnedBadges: true }))).toBeNull();
    expect(
      resolveBadgeDecision(creator, settings({ hideCreatorOwnedBadges: false })),
    ).not.toBeNull();
  });

  it("derives color from the label, overriding a mismatched payload badge_color", () => {
    // A tampered/stale payload claims GREEN for DISPUTED; the client must enforce
    // RED-only-DISPUTED locally and never trust the wire color blindly.
    const tampered = ok(
      researchedFixture({
        classification: {
          label: "DISPUTED",
          confidence: 0.5,
          confidence_label: "DISPUTED",
          summary: "s",
        },
        badge_color: "GREEN",
      }),
    );
    expect(resolveBadgeDecision(tampered, settings())).toEqual({ label: "DISPUTED", color: "RED" });
  });

  it("never emits RED for a non-DISPUTED label even if the payload says RED", () => {
    const tampered = ok(
      researchedFixture({
        classification: {
          label: "PE_BACKED",
          confidence: 0.9,
          confidence_label: "CONFIRMED",
          summary: "s",
        },
        badge_color: "RED",
      }),
    );
    expect(resolveBadgeDecision(tampered, settings())).toEqual({
      label: "PE_BACKED",
      color: "ORANGE",
    });
  });
});

describe("renderBadge — insertion", () => {
  it("inserts a shadow-DOM badge at the watch owner anchor with the correct label", () => {
    const doc = watchDoc();
    const host = renderBadge({
      doc,
      url: WATCH_URL,
      response: ok(
        researchedFixture({
          classification: {
            label: "CORPORATE_OWNED",
            confidence: 0.95,
            confidence_label: "CONFIRMED",
            summary: "s",
          },
          badge_color: "PURPLE",
        }),
      ),
      settings: settings(),
    });
    expect(host).not.toBeNull();
    expect(hosts(doc)).toHaveLength(1);
    expect(host!.shadowRoot).not.toBeNull();
    expect(host!.shadowRoot!.textContent).toContain(BADGE_LABELS.CORPORATE_OWNED);
    const badge = host!.shadowRoot!.querySelector("[data-cw-color]");
    expect(badge!.getAttribute("data-cw-color")).toBe("PURPLE");
    // anchored inside the owner renderer, not loose in the body
    expect(doc.querySelector("ytd-video-owner-renderer")!.contains(host!)).toBe(true);
  });

  it("inserts at the channel-page header anchor", () => {
    const doc = channelDoc();
    const host = renderBadge({
      doc,
      url: CHANNEL_URL,
      response: ok(researchedFixture()),
      settings: settings(),
    });
    expect(host).not.toBeNull();
    expect(doc.querySelector("yt-page-header-view-model")!.contains(host!)).toBe(true);
  });

  it.each([
    ["INDEPENDENT", "GREEN"],
    ["CREATOR_OWNED", "GREEN"],
    ["EXTERNALLY_FUNDED", "BLUE"],
    ["CORPORATE_OWNED", "PURPLE"],
    ["PE_BACKED", "ORANGE"],
    ["DISPUTED", "RED"],
  ] as const)("renders %s with color %s and its exact label", (label, color) => {
    const doc = watchDoc();
    const host = renderBadge({
      doc,
      url: WATCH_URL,
      response: ok(
        researchedFixture({
          classification: { label, confidence: 0.95, confidence_label: "CONFIRMED", summary: "s" },
          badge_color: color,
        }),
      ),
      settings: settings(),
    });
    const badge = host!.shadowRoot!.querySelector("[data-cw-color]")!;
    expect(badge.getAttribute("data-cw-color")).toBe(color);
    expect(host!.shadowRoot!.textContent).toContain(BADGE_LABELS[label]);
  });

  it("uses the reviewed copy-module aria-label (no inline English)", () => {
    const doc = watchDoc();
    const host = renderBadge({
      doc,
      url: WATCH_URL,
      response: ok(
        researchedFixture({
          classification: {
            label: "PE_BACKED",
            confidence: 0.9,
            confidence_label: "CONFIRMED",
            summary: "s",
          },
          badge_color: "ORANGE",
        }),
      ),
      settings: settings(),
    });
    const badge = host!.shadowRoot!.querySelector("[data-cw-color]")!;
    expect(badge.getAttribute("aria-label")).toBe(badgeAriaLabel("PE_BACKED"));
  });

  it("does not create a duplicate badge on re-render (teardown before insert)", () => {
    const doc = watchDoc();
    renderBadge({ doc, url: WATCH_URL, response: ok(researchedFixture()), settings: settings() });
    renderBadge({ doc, url: WATCH_URL, response: ok(researchedFixture()), settings: settings() });
    renderBadge({ doc, url: WATCH_URL, response: ok(researchedFixture()), settings: settings() });
    expect(hosts(doc)).toHaveLength(1);
  });

  it("clears the badge when the response is null (clear signal)", () => {
    const doc = watchDoc();
    renderBadge({ doc, url: WATCH_URL, response: ok(researchedFixture()), settings: settings() });
    expect(hosts(doc)).toHaveLength(1);
    const host = renderBadge({ doc, url: WATCH_URL, response: null, settings: settings() });
    expect(host).toBeNull();
    expect(hosts(doc)).toHaveLength(0);
  });

  it("renders nothing for an UNRESEARCHED channel by default", () => {
    const doc = watchDoc();
    const host = renderBadge({
      doc,
      url: WATCH_URL,
      response: ok(unresearchedFixture()),
      settings: settings(),
    });
    expect(host).toBeNull();
    expect(hosts(doc)).toHaveLength(0);
  });

  it("respects watch_and_channel_only scope on a non-channel page", () => {
    const doc = watchDoc(); // anchor present, but URL is the home feed
    const host = renderBadge({
      doc,
      url: HOME_URL,
      response: ok(researchedFixture()),
      settings: settings({ badgeScope: "watch_and_channel_only" }),
    });
    expect(host).toBeNull();
  });

  it("fail-silent: returns null (no throw) when no anchor exists", () => {
    const doc = document.implementation.createHTMLDocument("empty");
    expect(() => {
      const host = renderBadge({
        doc,
        url: WATCH_URL,
        response: ok(researchedFixture()),
        settings: settings(),
      });
      expect(host).toBeNull();
    }).not.toThrow();
  });

  it("invokes onActivate with the researched payload when the badge is clicked", () => {
    const doc = watchDoc();
    const onActivate = vi.fn();
    const payload = researchedFixture();
    const host = renderBadge({
      doc,
      url: WATCH_URL,
      response: ok(payload),
      settings: settings(),
      onActivate,
    });
    const badge = host!.shadowRoot!.querySelector<HTMLElement>("[data-cw-color]")!;
    badge.click();
    expect(onActivate).toHaveBeenCalledWith(payload);
  });
});

describe("resolveBadgeDecision — operative entity name (adjudicated naming)", () => {
  it("uses the ULTIMATE PE firm name for PE_BACKED", () => {
    const d = resolveBadgeDecision(
      ok(
        researchedFixture({
          classification: {
            label: "PE_BACKED",
            confidence: 0.95,
            confidence_label: "CONFIRMED",
            summary: "s",
          },
          badge_color: "ORANGE",
          direct_owner: { id: "e1", name: "Moonbug Entertainment", type: "COMPANY" },
          ultimate_parent: { id: "e2", name: "Blackstone", type: "PRIVATE_EQUITY_FIRM" },
        }),
      ),
      settings(),
    );
    expect(d).toEqual({ label: "PE_BACKED", color: "ORANGE", name: "Blackstone" });
  });

  it("uses the DIRECT owner name for CORPORATE_OWNED and NONPROFIT_OWNED", () => {
    const corp = resolveBadgeDecision(
      ok(
        researchedFixture({
          classification: {
            label: "CORPORATE_OWNED",
            confidence: 0.9,
            confidence_label: "CONFIRMED",
            summary: "s",
          },
          badge_color: "PURPLE",
          direct_owner: { id: "e1", name: "MegaCorp", type: "COMPANY" },
        }),
      ),
      settings(),
    );
    expect(corp?.name).toBe("MegaCorp");

    const np = resolveBadgeDecision(
      ok(
        researchedFixture({
          classification: {
            label: "NONPROFIT_OWNED",
            confidence: 0.9,
            confidence_label: "CONFIRMED",
            summary: "s",
          },
          badge_color: "PURPLE",
          direct_owner: { id: "e1", name: "Complexly", type: "NONPROFIT" },
        }),
      ),
      settings(),
    );
    expect(np?.name).toBe("Complexly");
  });

  it("carries no name for CREATOR_OWNED even when an owner is present", () => {
    const d = resolveBadgeDecision(
      ok(
        researchedFixture({
          classification: {
            label: "CREATOR_OWNED",
            confidence: 0.9,
            confidence_label: "CONFIRMED",
            summary: "s",
          },
          badge_color: "GREEN",
          direct_owner: { id: "e1", name: "Jane Creator", type: "PERSON" },
        }),
      ),
      settings(),
    );
    expect(d?.name).toBeUndefined();
  });
});

describe("renderBadge — named badge text", () => {
  it("renders '${label} · ${name}' for a PE_BACKED channel with a PE parent", () => {
    const doc = watchDoc();
    const host = renderBadge({
      doc,
      url: WATCH_URL,
      response: ok(
        researchedFixture({
          classification: {
            label: "PE_BACKED",
            confidence: 0.95,
            confidence_label: "CONFIRMED",
            summary: "s",
          },
          badge_color: "ORANGE",
          direct_owner: { id: "e1", name: "Moonbug Entertainment", type: "COMPANY" },
          ultimate_parent: { id: "e2", name: "Blackstone", type: "PRIVATE_EQUITY_FIRM" },
        }),
      ),
      settings: settings(),
    });
    const badge = host!.shadowRoot!.querySelector("[data-cw-color]")!;
    expect(badge.textContent).toBe(badgeText("PE_BACKED", "Blackstone"));
    expect(badge.textContent).toBe("PE-Backed · Blackstone");
    expect(badge.getAttribute("aria-label")).toBe(badgeAriaLabel("PE_BACKED", "Blackstone"));
  });

  it("truncates a long owner name inside the chip (full name lives in the panel)", () => {
    const long = "The Very Long Holding Company International Group";
    const doc = watchDoc();
    const host = renderBadge({
      doc,
      url: WATCH_URL,
      response: ok(
        researchedFixture({
          classification: {
            label: "CORPORATE_OWNED",
            confidence: 0.95,
            confidence_label: "CONFIRMED",
            summary: "s",
          },
          badge_color: "PURPLE",
          direct_owner: { id: "e1", name: long, type: "COMPANY" },
        }),
      ),
      settings: settings(),
    });
    const badge = host!.shadowRoot!.querySelector("[data-cw-color]")!;
    expect(badge.textContent).toBe(badgeText("CORPORATE_OWNED", long));
    expect(badge.textContent!.endsWith("…")).toBe(true);
    // the aria-label announces the FULL name (screen readers aren't chip-width limited)
    expect(badge.getAttribute("aria-label")).toContain(long);
  });
});

describe("removeBadge", () => {
  it("is a no-op when nothing is mounted", () => {
    const doc = watchDoc();
    expect(() => removeBadge(doc)).not.toThrow();
    expect(hosts(doc)).toHaveLength(0);
  });
});
