# Selector health

Vitest suite that runs every entry in `apps/extension/src/content/selectors.ts`
against stored YouTube page snapshots and fails loudly, naming the exact
selector, when a match that used to happen stops happening — the signal that
YouTube shipped a markup change our fallbacks no longer survive.

- `selectors.test.ts` — imports `SELECTORS`/`queryFirst` directly from the
  extension source (relative import; `apps/extension` has no package
  `exports`, so this is deliberate, not a workaround) and checks each selector
  against a per-fixture `EXPECTATIONS` table. See the doc comment at the top
  of the file for why some real snapshots legitimately produce zero matches
  today, and why the table is typed so a new `selectors.ts` entry without a
  matching expectation fails **typecheck**, not just a silently-skipped test.
- `fixtures/hydrated-watch-owner.html`, `fixtures/hydrated-channel-header.html`
  — small, hand-written synthetic snippets standing in for post-hydration
  YouTube DOM. The real snapshots in `apps/extension/tests/fixtures/` were
  captured pre-hydration (see that directory's README), so a couple of
  selectors can only be proven correct against these until a fresh
  post-hydration snapshot is captured.

Run with `pnpm --filter @channelwatch/selector-health-tests test`, or as part
of the root `pnpm test` / `turbo run test`.

This is a fixture-vs-selector regression check, not a live crawler — the
brief for the M3+ cron job that re-fetches fresh snapshots is out of scope
here.
