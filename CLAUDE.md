# CHANNELWATCH

Open-source browser extension + research platform showing YouTube viewers who owns,
finances, or operates the channels they watch — evidence-first, human-reviewed,
defamation-aware. See `docs/SPEC.md` for the full founding spec and
`docs/plan.md` for the approved build plan. Once written, `docs/METHODOLOGY.md`
and `MANIFESTO.md` are the project's constitution.

## Non-negotiable project rules

These are policy, not preference. Do not violate them even if a change "works":

1. **Never present uncertain ownership as fact.** Every published claim traces to
   inspectable sources. Tier 4 evidence (speculation, style changes, anonymous tips)
   may create research leads, never published claims.
2. **All user-facing ownership language comes from the reviewed copy module**
   (`packages/schemas/src/copy.ts`) — never ad-hoc strings in components. Badge
   labels are enum values, never free text.
3. **Red badge ≠ private equity.** Red is reserved for data-quality/disclosure
   disputes. PE-backed is orange. Badges describe structure, not misconduct.
4. **Channels are identified by immutable YouTube channel ID** (`UC…`), never by
   display name or handle alone. Handles and names change.
5. **Privacy: the extension sends only channel ID + extension version.** No page
   URLs, no video IDs unless required, no cookies, no user identity, no telemetry
   by default. Never widen extension permissions without explicit discussion.
6. **Every DB mutation writes an `audit_events` record** (who/what/when/why/evidence).
   No silent edits to published records — corrections leave a visible trail.
7. **LLMs draft, humans publish.** There is no code path that publishes a claim
   without human review. Classification is _computed_ from reviewed relationships
   via `packages/graph`, never stored as unexplained truth.
8. **Precision over recall.** A missed acquisition is acceptable; a false
   accusation is not. When evidence is thin, the answer is "Unknown", not a guess.
9. **Separate investment from ownership from editorial control.** They are
   different relationship types in the graph and different words in the UI.

## Stack

TypeScript-only monorepo: pnpm workspaces + Turborepo.

- `apps/extension` — Manifest V3, React + Vite. Content script: youtube-observer →
  channel-resolver → badge-renderer → ownership-panel. Background SW: API client +
  `chrome.storage` cache.
- `apps/web` — Next.js. Public site (channel pages, methodology, corrections form)
  plus authenticated `/review` console (claim queue, entity CRUD, audit viewer).
- `services/api` — Hono + Drizzle ORM + PostgreSQL. Public read endpoints under
  `/api/v1`, corrections POST, authed reviewer endpoints, rate limiting, audit
  middleware.
- `packages/schemas` — Zod schemas, enums (entity/relationship/claim/confidence
  taxonomies), and the reviewed UI copy module. **Single source of truth** — API,
  web, extension, and data importer all validate against these.
- `packages/graph` — ownership traversal, ultimate-parent resolution,
  classification derivation. Pure functions, heavily unit-tested.
- `packages/scoring` — confidence formula, publication thresholds, explanation
  codes. Pure functions, heavily unit-tested.
- `data/research/` — one YAML file per researched channel (claims + sources +
  excerpts), Zod-validated, imported to Postgres by script. PR review of these
  files IS the research review workflow during the seed phase.

## Commands

```
pnpm dev              # turbo dev across workspaces
pnpm test             # vitest everywhere (DB-gated API tests need DATABASE_URL; they run in CI)
pnpm lint             # eslint; pnpm format:check for prettier
pnpm db:migrate       # drizzle migrations (needs DATABASE_URL, see .env.example)
pnpm db:seed          # idempotent SPEC §35 dev seed
pnpm import:research  # validate + import data/research/*.yaml (idempotent)
pnpm --filter @channelwatch/api dev         # run the API (localhost:8787)
pnpm --filter @channelwatch/extension build # MV3 bundle → apps/extension/dist (load unpacked)
docker compose up -d postgres               # local Postgres
```

Extension API origin is baked at build time from `VITE_API_BASE_URL`
(manifest host_permissions AND the settings default read the same var).

## Conventions

- TDD for `packages/scoring`, `packages/graph`, and the extension channel-resolver —
  these carry the correctness risk.
- All YouTube DOM selectors live in `apps/extension/src/content/selectors.ts`;
  selector-health tests run against stored page snapshots in `tests/selector_health/`.
  The extension fails silently — it must never break YouTube.
- Extension cache TTLs: confirmed 7d, recently-changed 6h, unknown 24h,
  disputed 1h, API error 10m.
- Confidence bands: ≥0.90 Confirmed, 0.75 High, 0.55 Moderate, 0.30 Low,
  below = research lead only (not publishable). A public PE-backed label requires
  one Tier 1 source or two independent Tier 2 sources + strong entity match.
- Sensitive claims (hidden ownership, fraud, named individuals, political
  influence) require two-person review before publication.

## Status

M0 (scaffold + constitution docs), M1 (data core: schemas/scoring/graph/DB/importer),
M2 (public `/api/v1` read endpoints + corrections POST, MV3 extension with badge +
evidence panel, selector-health suite), and the M3 core are complete. M3 so far:
temporal ownership history (`ownershipHistory()` in `packages/graph`,
`ownership_history` on the lookup payload, "Ownership over time" in the extension
panel and web channel pages; transition conventions documented in
`data/research/_TEMPLATE.yaml`); the whole-graph recompute is the SINGLE writer of
cached `published_classification` (the importer's per-record label is informational
only — re-import must be a no-op); `apps/web` exists (Next.js 15): public site
(channel pages, search, methodology, corrections) + authed `/review` console
(scrypt + Postgres-session cookie auth, claim queue with two-person rule, entity
CRUD, correction inbox, audit viewer); 33 researched channels in `data/research/`.
Remaining for M3: dataset expansion toward ~100 verified channels and launch prep
(legal review §23.4, Chrome Web Store listing, reproducible build). Open taxonomy
policy questions are tracked in `.superpowers/sdd/progress.md`.
Package/npm namespace is `channelwatch`; directory is `YT_Channel_Watch`.

Research records in `data/research/` are drafts until a human sets `reviewed_by`;
records flagged for two-person review (PE chains, named individuals, disputed
characterizations) need both reviewers before public launch.

## Git

Plain commit messages only — no Co-Authored-By or generated-with trailers.
