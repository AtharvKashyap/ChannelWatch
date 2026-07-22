# @channelwatch/extension

CHANNELWATCH browser extension (Manifest V3, React + Vite). Shows viewers who
owns, finances, or commercially influences the YouTube channel they're
watching — see the repo root `README.md` and `docs/SPEC.md` for the project
as a whole.

## Layout

- `src/content/` — content script pipeline: `youtube-observer.ts` (watches the
  YouTube SPA for navigation) → `channel-resolver.ts` (extracts the immutable
  `UC…` channel ID) → `badge-renderer.ts` + `ownership-panel.tsx` (renders the
  badge and its evidence panel). `selectors.ts` centralizes every YouTube DOM
  selector the content script uses — see "Selector health" below.
- `src/background/` — MV3 service worker: `api-client.ts` (fetches lookups
  from `services/api`), `cache.ts` + `ttl.ts` (`chrome.storage.local` cache).
- `src/options/`, `src/popup/` — settings page and toolbar popup (React).
- `src/shared/settings.ts` — `chrome.storage.sync` settings (badge scope,
  hide-creator-owned, only-confirmed, API base URL).
- `manifest.config.ts` — MV3 manifest; permissions kept to the documented
  minimum (see "Privacy" below).
- `tests/fixtures/` — sanitized real YouTube page snapshots used by the
  channel-resolver unit tests (`tests/content/`); see that directory's README
  for provenance and sanitization.

## Build

```bash
pnpm --filter @channelwatch/extension build
```

Output goes to `apps/extension/dist/` — a directory Chrome can load unpacked.

## Load unpacked in Chrome

1. Build the extension (above).
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select `apps/extension/dist`.
5. CHANNELWATCH now appears in your extensions list and toolbar. Visit any
   `youtube.com` watch or channel page for a researched channel to see it act.

To pick up code changes, re-run the build (or use the watch mode below) and
click the reload icon on the extension's card in `chrome://extensions`.

## Dev workflow

Full local loop, from the repo root:

```bash
# 1. Start Postgres
docker compose up -d postgres

# 2. Apply migrations
pnpm db:migrate

# 3. Load data — either the SPEC §35 example seed, the researched pilot
#    channels (data/research/*.yaml — includes Little Baby Bum, see below),
#    or both:
pnpm db:seed
pnpm import:research

# 4. Run the API (services/api), in its own terminal
pnpm --filter @channelwatch/api dev          # tsx watch src/server.ts, or:
npx tsx services/api/src/server.ts           # one-shot, no watch

# 5. Build the extension (watch mode rebuilds on save)
pnpm --filter @channelwatch/extension dev    # vite build --watch --mode development

# 6. Load apps/extension/dist as an unpacked extension (see above), then
#    visit a seeded/researched channel on youtube.com.
```

The API defaults to `http://localhost:8787`; the extension's default
`apiBaseUrl` setting and its `host_permissions` both track
`VITE_API_BASE_URL` (see `src/shared/settings.ts` and `manifest.config.ts`) —
override that env var consistently if you run the API elsewhere.

## Settings

Available from the extension's options page (`chrome://extensions` → Details
→ Extension options, or the popup's settings link):

- **Badge scope** — show the ownership badge everywhere YouTube renders a
  channel, or only on the watch page and the channel's own page.
- **Hide creator-owned badges** — suppress the badge for channels with
  nothing to flag (no PE/corporate ownership).
- **Only confirmed** — suppress badges below `CONFIRMED` confidence.
- **API base URL** (dev) — override the backend origin; must be a plain
  `http://`/`https://` origin (no path/query/fragment).

## Privacy

The extension sends only the YouTube channel ID and its own version to the
API — no page URL, no video ID (unless required), no cookies, no user
identity, no telemetry by default. `manifest.config.ts` requests only the
`storage` permission plus host access to `youtube.com` and the configured API
origin — nothing else. See `PRIVACY.md` (repo root) for the full policy.

## Selector health

YouTube changes its DOM constantly. Every selector the content script uses is
centralized in `src/content/selectors.ts`; `tests/selector_health/` at the
repo root runs each one against stored page snapshots and fails loudly,
naming the exact selector, if a match it used to make stops matching. If that
suite fails after a YouTube markup change, fix the fallbacks in
`selectors.ts` first — the extension is designed to fail silently in
production (never break the YouTube page), so this test suite is the actual
signal that something needs attention.

## Manual end-to-end script

Automated tests cover the resolver, cache, badge, and panel in isolation;
this is the manual check that the whole pipeline works against a live
YouTube page and a real backend.

1. Follow the **Dev workflow** above through step 6 (Postgres up, migrated,
   `pnpm import:research` run, API running, extension built and loaded
   unpacked).
2. Visit **Little Baby Bum** on youtube.com — either its channel page
   (`https://www.youtube.com/channel/UCKAqou7V9FAWXpZd9xtOg3Q`, or
   `https://www.youtube.com/@LittleBabyBum`) or any of its watch pages.
3. **Expected**: an **orange** "PE-backed" badge appears next to the channel
   name (orange is reserved for PE-backed structures — see `CLAUDE.md` rule
   3; it is never used to imply misconduct).
4. Click/open the badge's panel. **Expected contents**:
   - The ownership chain summary: Little Baby Bum → Moonbug Entertainment →
     Candle Media → Blackstone Inc. (per `data/research/little-baby-bum.yaml`
     — Moonbug's 2018 acquisition, Candle's 2021 acquisition of Moonbug, and
     Blackstone's backing of Candle).
   - Source citations for the chain (Blackstone's own press releases plus
     Kidscreen/Hollywood Reporter coverage).
   - The standard disclaimer copy (from `packages/schemas/src/copy.ts`) — never
     ad-hoc panel text.
5. If the badge does not appear: confirm the API is reachable at the
   extension's configured `apiBaseUrl`, that `pnpm import:research` completed
   without error, and that the extension was reloaded in `chrome://extensions`
   after the most recent build.
