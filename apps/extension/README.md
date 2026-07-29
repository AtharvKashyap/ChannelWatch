# @channelwatch/extension

CHANNELWATCH browser extension (Manifest V3, React + Vite). Shows viewers who
owns, finances, or commercially influences the YouTube channel they're
watching — see the repo root `README.md` for the project as a whole.

## The UI is the toolbar popup — nothing is injected into YouTube

The extension injects **nothing** into YouTube pages: no badges, no panels, no
DOM mutation anywhere. The **toolbar popup is the only UI**. Open a YouTube
**watch** page (`/watch`, `/shorts/…`, `/live/…`) and click the CHANNELWATCH
toolbar icon: the popup reads the currently-playing video's channel and shows
its ownership box (label, ownership chain, "Ownership over time", evidence
count, the standing editorial disclaimer, and a "Report an error" link). On the
homepage, channel pages, or non-YouTube tabs it shows a friendly prompt to open
a video.

## Layout

- `src/content/index.ts` — the **minimal content script**. Its only job is to
  resolve the immutable `UC…` channel ID of the current watch-page video on
  demand (when the popup sends `RESOLVE_CHANNEL`) using `channel-resolver.ts`,
  and reply. It renders nothing and stores nothing. `channel-resolver.ts`
  extracts the ID from `ytInitialData`/`ytInitialPlayerResponse` and the owner
  anchor; `selectors.ts` centralizes every YouTube DOM selector it reads (see
  "Selector health" below).
- `src/background/` — MV3 service worker: `api-client.ts` (fetches lookups from
  `services/api`), `cache.ts` (an **in-memory session `Map`** keyed by channel
  ID — never persisted, no `chrome.storage`) + `ttl.ts` (how long an entry
  stays fresh in that Map).
- `src/popup/` — the toolbar popup (React); the extension's only UI.
- `src/shared/config.ts` — build-time constants baked from Vite env vars
  (`VITE_API_BASE_URL`, `VITE_WEB_BASE_URL`). Not user data; nothing is stored.
- `src/shared/messages.ts` — the `RESOLVE_CHANNEL` (popup ↔ content) and
  `LOOKUP_CHANNEL` (popup ↔ background) message contracts.
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
5. CHANNELWATCH now appears in your extensions list and toolbar. Open a
   `youtube.com` **watch** page for a researched channel and click the toolbar
   icon to see its ownership box.

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
#    open a seeded/researched channel's watch page on youtube.com and click
#    the toolbar icon.
```

The API defaults to `http://localhost:8787`; the background API base URL
constant and the manifest `host_permissions` both track `VITE_API_BASE_URL`
(see `src/shared/config.ts` and `manifest.config.ts`) — override that env var
consistently if you run the API elsewhere. The "Report an error" link opens
`VITE_WEB_BASE_URL` (default `http://localhost:3000`).

## Configuration (no settings page)

There is **no settings/options page** and **no persisted settings** — the
redesign removed them. The two configurable values are baked into the bundle at
build time from Vite env vars, not stored per user:

- `VITE_API_BASE_URL` — the backend origin the popup looks up ownership from
  (also the manifest host permission). Default `http://localhost:8787`.
- `VITE_WEB_BASE_URL` — the public site origin for the "Report an error" link.
  Default `http://localhost:3000`.

## Privacy

The extension **persists no user data at all**. It sends only the YouTube
channel ID and its own version to the API — no page URL, no video ID, no
cookies, no user identity, no telemetry. The lookup cache is an in-memory `Map`
in the service worker (gone on restart); there is **no `chrome.storage`** and
**no `storage` permission**. `manifest.config.ts` requests no API permissions —
only host access to `youtube.com` (the minimal channel-ID resolver) and the
configured API origin (background lookups). See `PRIVACY.md` (repo root) for the
full policy.

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

Automated tests cover the resolver, cache, and popup in isolation; this is the
manual check that the whole flow works against a live YouTube page and a real
backend.

1. Follow the **Dev workflow** above through step 6 (Postgres up, migrated,
   `pnpm import:research` run, API running, extension built and loaded
   unpacked).
2. Open a **Little Baby Bum watch page** on youtube.com (any video from
   `https://www.youtube.com/@LittleBabyBum`). Channel pages and the homepage are
   deliberately out of scope — the extension acts only on watch pages.
3. Click the **CHANNELWATCH toolbar icon**. **Expected**: the popup shows an
   ownership box with an **orange** "PE-Backed" label (orange is reserved for
   PE-backed structures — never red, and never an implication of
   misconduct), the ownership chain (Little Baby Bum → Moonbug Entertainment →
   Candle Media → Blackstone Inc., per `data/research/little-baby-bum.yaml`), the
   "Ownership over time" history, the evidence count, and the standing
   disclaimer copy (from `packages/schemas/src/copy.ts` — never ad-hoc text).
4. The **"Report an error"** link opens the public correction form
   (`VITE_WEB_BASE_URL/corrections?channel=UC…`) in a new tab.
5. If the box does not appear: confirm the active tab is a `/watch` page, that
   the API is reachable at `VITE_API_BASE_URL`, that `pnpm import:research`
   completed without error, and that the extension was reloaded in
   `chrome://extensions` after the most recent build.
