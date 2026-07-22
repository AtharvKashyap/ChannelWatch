/**
 * Selector-health suite (CLAUDE.md "Conventions" — "selector-health tests run
 * against stored page snapshots in `tests/selector_health/`").
 *
 * YouTube ships DOM changes constantly. This suite runs EVERY entry in
 * `apps/extension/src/content/selectors.ts` — imported directly from source,
 * not duplicated here — against the sanitized page snapshots checked into
 * `apps/extension/tests/fixtures/` (plus two small synthetic post-hydration
 * snippets in `./fixtures/`, see below) and fails loudly, naming the exact
 * selector, when a match that used to happen stops happening.
 *
 * WHY per-selector, per-fixture expectations (not blanket "must match
 * everywhere"): `apps/extension/tests/fixtures/channel-page.html` is a
 * pre-hydration shell (see its README) and `watch-page.html` was also
 * captured before the owner renderer finished hydrating, so several
 * selectors LEGITIMATELY match zero elements on one or both real snapshots
 * today. Asserting "must match" there would be a false failure; asserting
 * nothing at all would let a real breakage slip through silently. Instead,
 * `EXPECTATIONS` below records, per selector, per fixture, whether a match is
 * expected ("match") or a documented, currently-known gap ("zero"). Selectors
 * that are only provably correct once hydration has happened
 * (`watchOwnerLink`, `channelBadgeAnchor`) are additionally checked against a
 * small synthetic hydrated snippet.
 *
 * `EXPECTATIONS` is typed `Record<SelectorName, ...>` (every key required),
 * so adding a new entry to `selectors.ts` without adding a matching
 * expectation here is a TYPECHECK failure, not just a silently-skipped test —
 * "every selectors.ts entry" is enforced at compile time, not by remembering
 * to update a list.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SELECTORS,
  queryFirst,
  type SelectorName,
} from "../../apps/extension/src/content/selectors.js";

const here = dirname(fileURLToPath(import.meta.url));

const readHtml = (path: string): string => readFileSync(join(here, path), "utf-8");
const parse = (html: string): Document => new DOMParser().parseFromString(html, "text/html");

type FixtureKey = "watchPage" | "channelPage" | "hydratedWatchOwner" | "hydratedChannelHeader";

/**
 * The real, sanitized YouTube snapshots (shared with the channel-resolver
 * unit tests) plus the two synthetic post-hydration snippets that live
 * alongside this file. Parsed once, up front — the file names/paths are the
 * single source of truth for provenance (see the READMEs next to each file).
 */
const FIXTURES: Record<FixtureKey, Document> = {
  watchPage: parse(readHtml("../../apps/extension/tests/fixtures/watch-page.html")),
  channelPage: parse(readHtml("../../apps/extension/tests/fixtures/channel-page.html")),
  hydratedWatchOwner: parse(readHtml("./fixtures/hydrated-watch-owner.html")),
  hydratedChannelHeader: parse(readHtml("./fixtures/hydrated-channel-header.html")),
};

type Expectation = "match" | "zero";

/**
 * Per-selector, per-fixture expectations. See the file-level doc comment for
 * why "zero" entries exist and why this being `Record<SelectorName, ...>`
 * (not `Partial<...>`) makes a missing entry a typecheck failure.
 */
const EXPECTATIONS: Record<SelectorName, Partial<Record<FixtureKey, Expectation>>> = {
  canonicalLink: { watchPage: "match", channelPage: "match" },
  ogUrl: { watchPage: "match", channelPage: "match" },
  initialStateScript: { watchPage: "match", channelPage: "match" },
  // Both real snapshots pre-date owner-renderer hydration (see module doc);
  // the selector is only provably correct against the synthetic hydrated
  // snippet until a fresh post-hydration snapshot is captured.
  watchOwnerLink: { watchPage: "zero", channelPage: "zero", hydratedWatchOwner: "match" },
  microdataAuthorUrl: { watchPage: "match", channelPage: "match" },
  // `watchBadgeAnchor`'s broad `#video-owner` fallback already matches both
  // real (pre-hydration) snapshots, and its most-specific selector matches
  // the hydrated snippet too.
  watchBadgeAnchor: { watchPage: "match", channelPage: "match", hydratedWatchOwner: "match" },
  // `channel-page.html` is a pre-hydration shell with no header node at all
  // (see its README); only the synthetic hydrated snippet can exercise this.
  channelBadgeAnchor: { watchPage: "zero", channelPage: "zero", hydratedChannelHeader: "match" },
};

describe("selector health (apps/extension/src/content/selectors.ts)", () => {
  for (const name of Object.keys(SELECTORS) as SelectorName[]) {
    describe(name, () => {
      const expectation = EXPECTATIONS[name];
      const fixtureKeys = Object.keys(expectation) as FixtureKey[];

      it("has a documented fixture expectation", () => {
        // Guards against an EXPECTATIONS entry that exists (satisfying the
        // Record<SelectorName, ...> type) but was left an empty object.
        expect(fixtureKeys.length).toBeGreaterThan(0);
      });

      for (const fixtureKey of fixtureKeys) {
        const expected = expectation[fixtureKey];

        it(`${expected === "match" ? "matches" : "does not match (documented gap)"} the "${fixtureKey}" fixture`, () => {
          const match = queryFirst(FIXTURES[fixtureKey], name);

          if (expected === "match") {
            expect(
              match,
              `Selector "${name}" matched ZERO elements in the "${fixtureKey}" fixture, but ` +
                `is expected to match. YouTube markup likely changed — update the fallbacks ` +
                `for "${name}" in apps/extension/src/content/selectors.ts.`,
            ).not.toBeNull();
          } else {
            expect(
              match,
              `Selector "${name}" now matches an element in the "${fixtureKey}" fixture, but ` +
                `this suite documents that as a known zero-match gap (see EXPECTATIONS in ` +
                `tests/selector_health/selectors.test.ts). If this is expected (e.g. the ` +
                `fixture was refreshed post-hydration), update the expectation to "match".`,
            ).toBeNull();
          }
        });
      }
    });
  }
});
