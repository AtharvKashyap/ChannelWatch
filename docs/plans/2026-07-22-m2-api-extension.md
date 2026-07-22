# Milestone 2 — Public API + Chrome Extension: Implementation Plan

Executes Milestone 2 of `docs/plan.md`. Builds on merged M1 (branch: `m2-api-extension`).

## Global Constraints

- Everything from M0/M1 conventions: TS-only, pnpm+Turborepo, `@channelwatch/*`, tsconfig base + typecheck-with-tests, Vitest, plain commits, no trailers.
- Single source of truth: labels/colors/copy/TTLs/thresholds from `@channelwatch/schemas`; classification always computed via `@channelwatch/graph`. No ad-hoc user-facing strings — the copy module only.
- Extension privacy (CLAUDE.md rule 5): requests carry ONLY the YouTube channel ID + extension version. No page URLs, video IDs, cookies, identity, telemetry. Permissions: `storage` + host permissions for youtube.com and the API origin only.
- Extension must fail silently — it must never break YouTube pages. All content-script entry points wrapped in error boundaries that no-op on failure.
- API responses must use neutral legal-safe copy; `GET /channels/youtube/{id}` returns exactly the `ChannelLookupResponse` shape (SPEC §17.2).
- Open policy question deferred to user checkpoint (do NOT resolve in code): how nonprofit-owned channels (e.g. vlogbrothers/Complexly) should classify — currently OWNERSHIP_UNCLEAR.

---

## Task 1: M2 cleanup batch (findings from M1 reviews + pilot import)

All items small and adjudicated:

- **Joint ownership (pilot gap, smosh case):** in `packages/graph`, when multiple owner candidates tie at the same precedence AND all tied owners are entity_type CREATOR or PERSON, classify as co-owned: return ALL tied owners as `directOwners` (extend the result shape; keep `directOwner` as the highest-confidence one for compatibility), do NOT return UNKNOWN, and apply rule 5 → CREATOR_OWNED with explanation code `JOINTLY_CREATOR_OWNED` (add to ExplanationCode in schemas). Mixed-type ties (e.g. a company and a person) remain UNKNOWN + MULTIPLE_OWNER_CANDIDATES. TDD: smosh-shaped fixture (two creator OWNS edges) → CREATOR_OWNED; mixed tie still UNKNOWN.
- **Full-date enforcement (pilot gap, partial-date import failures):** `ResearchRecord` date fields (`effective_from`, `effective_to`, `effective_date`, `published_at` where date-typed) must match `^\d{4}-\d{2}-\d{2}$`. Tests: `2018-09` rejected with clear message, `2018-09-15` accepted.
- **CI runs DB-gated tests:** add postgres:16 service to `.github/workflows/ci.yml` with healthcheck; set `DATABASE_URL` in env; add `"passThroughEnv": ["DATABASE_URL"]` to the test task in `turbo.json`; migration step before tests. The 5 DB-gated tests must run (not skip) in CI.
- **Mapper null-tolerance:** `rowToSource`/`rowToClaim` handle legitimately-null `status`/`tier`/`claim_status` (default UNKNOWN-ish per schema or make fields optional) instead of throwing; unit tests with null-bearing rows.
- **seed.ts computes classification** via `@channelwatch/graph` from the rows it seeds (no hardcoded PE_BACKED literal) and only writes audit rows when a row actually changed (reuse importer's change detection via `syncRow`, which may need extracting to `src/db/`).
- **NaN test:** scoring factor validation test asserting NaN throws (code already handles it).

Verification: root build/lint/typecheck/format:check/test green; with postgres: full DB suite green; re-import of data/research/*.yaml now derives smosh → CREATOR_OWNED. Commit.

## Task 2: Public read endpoints + corrections

In `services/api` (Hono):

- `GET /api/v1/channels/youtube/:youtubeChannelId` → `ChannelLookupResponse` (§17.2 exact shape) assembled from DB rows + live `deriveClassification` (do not trust the cached column blindly; recompute and use cached only as fallback), summary text from the copy module templates, evidence_count, disputed flag.
- `GET /api/v1/channels/:id/ownership` (relationship chain with entities), `/evidence` (sources with tier/status/excerpts), `/timeline` (relationships + claims ordered by effective dates).
- `GET /api/v1/entities/:id`, `GET /api/v1/channels/search?q=` (Postgres ILIKE/full-text on display_name+handle, limit 20).
- `POST /api/v1/corrections` and `POST /api/v1/submissions`: zod-validated bodies (add schemas to @channelwatch/schemas), insert `correction_requests` row + audit event, rate-limited.
- Middleware: rate limiting (in-memory token bucket per IP: 60 req/min read, 5/min POST), CORS (allow extension origins + configured web origin), security headers, JSON error envelope, request validation. 404s for unknown channels return `{researched: false}`-style neutral payload (200 with research_status UNRESEARCHED is fine — decide and document).
- Integration tests (DB-gated) for every endpoint against imported pilot data; unit tests for rate limiter.

Verification: with postgres+import, `curl` the lookup endpoint for the little-baby-bum channel id returns PE_BACKED §17.2-shaped JSON. Commit.

## Task 3: Extension scaffold + background service worker

`apps/extension` (`@channelwatch/extension`): Vite + `@crxjs/vite-plugin` + React + MV3.

- `manifest.config.ts`: permissions `["storage"]`, host_permissions youtube.com + API origin (from env, default http://localhost:8787), content script on youtube.com, background service worker, options page. NOTHING else.
- Background SW: message handler `LOOKUP_CHANNEL {channelId}` → checks `chrome.storage.local` cache (TTLs from schemas' CACHE_TTLS keyed by record state) → fetches `GET /channels/youtube/{id}` with `X-Extension-Version` header → caches → responds. Never store a viewing-history list — cache entries keyed by channel id only, pruned by TTL + LRU cap (500 entries).
- API client with timeout + error caching (apiError TTL). Settings store (chrome.storage.sync): badge scope (everywhere/watch+channel only), hide creator-owned badges, only-confirmed toggle, API base URL (dev).
- Unit tests (vitest, mock chrome APIs): cache TTL logic, LRU cap, message round-trip.

Verification: `pnpm --filter @channelwatch/extension build` produces a loadable MV3 bundle; tests green. Commit.

## Task 4: Content script — resolver + observer

- `src/content/selectors.ts`: EVERY selector centralized with named entries and fallback arrays.
- `channel-resolver.ts`: watch pages — extract channel id from `ytInitialData`/microdata/owner link href (`/channel/UC…`); channel pages — canonical link/meta; NEVER resolve by display name; return null when ambiguous. Handle pages needing backend resolution: skip in M2 (return null) — note for M3.
- `youtube-observer.ts`: listen `yt-navigate-finish` + debounced MutationObserver on the badge insertion point; re-resolve on SPA navigation; teardown/re-render without duplicate badges.
- Everything wrapped: one top-level try/catch per entry point, console.debug only, never throw into page.
- TDD against fixtures: store 2 sanitized YouTube HTML snapshots (watch page, channel page) in `tests/fixtures/` (fetch real pages, strip scripts/PII, keep structure) — resolver unit tests parse them (jsdom).

## Task 5: Badge + ownership panel

- `badge-renderer.ts`: small inline badge next to channel name (watch + channel pages), text/color from `@channelwatch/schemas` (BADGE_LABELS + classificationToBadgeColor mapped to CSS vars), shadow-DOM container to isolate styles, respects settings (scope, hide-creator-owned, only-confirmed), no badge when UNRESEARCHED unless setting enabled (default: show neutral "Ownership Unclear"? — default OFF for unresearched: render nothing to reduce noise; document).
- `ownership-panel.tsx` (React in shadow DOM): opens on badge click — classification, direct owner, ultimate parent, creator status when present, ownership-change date + recent-change warning, confidence label, evidence list (title/publisher/tier, links), last-reviewed date, the standing disclaimer from copy module verbatim, "Report an Error" linking to the corrections endpoint via a small in-panel form (POST /corrections) or mailto fallback — in-panel form preferred.
- Popup: extension status + link to options.
- Tests: renderer against snapshot fixtures (no duplicate badge on re-render; correct label/color per classification), panel component tests.

## Task 6: Selector health + e2e polish

- `tests/selector_health/` at repo root: vitest suite that runs every selectors.ts entry against the stored snapshots and fails loudly on zero-match (the M3+ cron re-fetches fresh snapshots — out of scope now).
- README for apps/extension: load-unpacked instructions, dev workflow with docker compose + seeded data.
- End-to-end manual script documented: docker up → migrate → import → build extension → load → visit pilot channel → badge shows.

Verification (milestone): full local e2e passes with the little-baby-bum channel showing an orange PE-Backed badge whose panel lists the Blackstone chain evidence with the disclaimer. Root suite green. CI green including DB tests.
