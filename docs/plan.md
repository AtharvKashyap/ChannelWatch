# CHANNELWATCH — Project Foundation Plan (Phase 0 + Phase 1 MVP)

## Context

The user has a comprehensive 40-section brainstormed spec for **CHANNELWATCH**: an open-source browser extension + research platform that shows YouTube viewers who owns, finances, or commercially controls the channels they watch — with an evidence-first, defamation-aware, human-reviewed data model. The project directory (`/Users/atharvk/Desktop/Claude projects/Double_Anonymity_Platform`) is currently **empty**; nothing exists yet.

Decisions made with the user:

- **Full backend from day 1** (API + PostgreSQL + reviewer console), not a static-dataset MVP.
- **TypeScript-only** codebase (this overrides the spec's Python/FastAPI backend).
- **Claude-assisted, human-verified** seed research (~25 → ~100 channels).
- **Real public launch** is the ambition — corrections workflow, audit trail, and legal-safe language are MVP-blocking, and pre-launch legal review is on the roadmap.

This plan covers: (a) modifications that improve the spec, (b) the concrete architecture and repo scaffold, (c) an executable milestone breakdown for Phase 0 + Phase 1, and (d) the CLAUDE.md to write. **Deliverables of this session: project scaffold docs + CLAUDE.md + design docs — per the spec's own "First Build Order", methodology and taxonomy come before code.**

---

## Modifications to the spec (improvements, with reasoning)

The spec is unusually strong on philosophy, evidence modeling, and legal caution. The changes below are about **executability**, not vision:

1. **TypeScript backend replaces Python/FastAPI** (user decision). Stack: **Hono** (runs on Node, fast, tiny) + **Drizzle ORM** + **PostgreSQL** + **Zod**. The killer benefit: one `packages/schemas` of Zod schemas validates the same data in the API, the reviewer console, the extension, and the seed-data pipeline. The spec's dual-toolchain plan (Python backend + TS schemas package + codegen) was its weakest engineering choice.
2. **Merge `apps/web` and `apps/reviewer-console` into one Next.js app** with an authenticated `/review` section. Three frontend apps for an MVP is over-scoped; the reviewer console is ~5 CRUD screens sharing components (EvidenceCard, ConfidenceLabel, Timeline) with the public site. Split later only if access-control needs diverge.
3. **Cut Redis, Celery/queues, object storage, Prometheus/Grafana, Terraform, Kubernetes from the MVP.** Postgres alone handles caching (HTTP cache headers + extension local cache already cover reads), rate limiting (a small middleware with a Postgres or in-memory store), and full-text search (`tsvector`). The spec itself says "Kubernetes is unnecessary" — apply the same discipline to the rest. Everything is containerized so any host works; hosting choice (Railway/Fly/Render + managed Postgres) is deferred to deployment time and is swappable.
4. **`services/research-worker` and `services/source-archiver` are deferred entirely (Phase 4).** For the MVP, "source archiving" is a small script: fetch URL → store content hash + title + excerpt in the `sources` table → request an archive.org snapshot and store the archive URL. No standing service.
5. **Simplify the claims model for the MVP without losing auditability.** Keep the spec's tables but make `relationships` the primary published artifact and `claims` the review-workflow artifact that produces relationships. The spec was ambiguous about which of the two the classifier reads; resolving that now prevents a data-model mess. Classification is **computed** from active relationships via graph traversal (`ultimate_parent`), never stored as unexplained truth — `channels.published_classification` is a denormalized cache with `explanation_codes`.
6. **Seed research workflow is Git-reviewable even though the DB is the source of truth.** Research records are authored as YAML files in `data/research/` (one per channel: claims + sources + excerpts), validated by Zod, and imported by a script. This gives PR-style review and diffable provenance for the seed phase while the runtime reads Postgres. Post-MVP, entry moves into the reviewer console.
7. **Legal-safe language is enforced in code, not just policy**: UI copy strings live in one reviewed module (`packages/schemas/src/copy.ts`), badge labels come from a fixed enum (never free text), and every evidence panel includes the standing disclaimer ("No conclusion is made about editorial interference"). Red badge reserved for data-quality disputes, per spec §9.2.
8. **Rename the directory.** The folder is `Double_Anonymity_Platform` (from an earlier idea); the repo should be `channelwatch/`. Ask user at execution time whether to init inside a renamed folder or create a sibling.
9. **Everything else in the spec is preserved** — evidence tiers, confidence model, two-person review policy, threat model, privacy rules (channel-ID-only lookups, no telemetry by default), non-goals, and phased roadmap — but recorded as docs now, built as systems in their listed phases.

---

## Architecture (MVP)

```
apps/extension        TS + React + Vite + CRXJS, Manifest V3 (Chrome first, Firefox in Phase 3)
  content script:     youtube-observer → channel-resolver → badge-renderer → ownership-panel
  background SW:      API client + chrome.storage cache (TTLs per spec §18.6)
apps/web              Next.js (public site: channel pages, methodology, corrections form
                      + authed /review: claim review, entity CRUD, audit viewer)
services/api          Hono + Drizzle + Zod + PostgreSQL  (public read endpoints, corrections
                      POST, authed reviewer endpoints, rate limiting, audit middleware)
packages/schemas      Zod schemas + enums + reviewed UI copy (single source of truth)
packages/graph        ownership traversal, ultimate-parent, classification derivation (pure functions)
packages/scoring      confidence math + publication thresholds + explanation codes (pure functions)
data/research         YAML seed records → validate → import script → Postgres
docs/                 METHODOLOGY.md, evidence-policy, data-model, legal-risk, threat-model…
```

DB tables (Drizzle, per spec §16 with modification #5): `channels`, `entities`, `entity_aliases`, `relationships`, `sources`, `claims`, `claim_sources`, `reviews`, `correction_requests`, `audit_events`, plus `reviewers` (auth).

Public API (spec §17, unchanged paths): `GET /api/v1/channels/youtube/{id}`, `/channels/{id}/ownership|evidence|timeline`, `GET /entities/{id}`, `GET /channels/search`, `POST /corrections`, `POST /submissions`. Authed: claim/review/entity CRUD. Every mutation writes `audit_events`.

Monorepo tooling: **pnpm workspaces + Turborepo**, Vitest everywhere, Playwright for extension e2e against saved YouTube page snapshots (selector-health tests, spec §28.4), ESLint + Prettier, GitHub Actions CI, docker-compose (api + postgres + web).

---

## Milestones

### Milestone 0 — Foundation (this is what gets executed first)

1. Scaffold monorepo (pnpm + turbo + tsconfig base + CI + docker-compose + .env.example).
2. Write **CLAUDE.md** (contents below).
3. Write core docs, adapted from the spec: `docs/METHODOLOGY.md` (evidence tiers §7, confidence model §8, review checklist §20), `docs/data-model.md` (with modification #5 resolved), `docs/legal-risk.md` (§23 safe-language table), `MANIFESTO.md`, `PRIVACY.md`, `SECURITY.md`, `CONTRIBUTING.md`. These are the project's constitution — the spec's First Build Order puts them before code, deliberately.
4. `packages/schemas`: all enums (entity types, relationship types, claim/evidence/confidence statuses — spec §8, §15) + Zod schemas + reviewed copy module. **TDD.**

### Milestone 1 — Data core

5. `services/api` skeleton + Drizzle schema + migrations + seed script.
6. `packages/scoring` (confidence formula §14.2, thresholds §14.3, explanation codes) and `packages/graph` (traversal, ultimate parent, classification derivation §26.2) as pure, heavily-tested functions.
7. YAML research-record format + validator + importer (`data/research/`).
8. Research **5 pilot channels** (Claude-assisted, user-verified) to pressure-test the taxonomy _before_ building UI — the spec's stated biggest risk is the taxonomy, not the tech.

### Milestone 2 — API + extension

9. Public read endpoints + rate limiting + audit middleware; corrections POST.
10. Extension: channel resolver (structured data → canonical URL → backend handle resolution, §18.4), badge on channel + watch pages, ownership panel with evidence + disclaimer, settings, local cache with §18.6 TTLs, fail-silent DOM handling.
11. Selector-health test suite against stored YouTube HTML snapshots.

### Milestone 3 — Review + launch prep

12. `/review` console: claim queue, approve/reject with reasoning, entity CRUD, correction inbox, audit viewer. Two-person-review flag for sensitive claims (§20.3).
13. Expand dataset to ~25, then ~100 channels (balanced per §37.3).
14. Public site: channel pages, methodology page, correction form.
15. Pre-launch checklist: legal review (§23.4), Chrome Web Store listing, privacy policy, reproducible build.

Each milestone ends with a review checkpoint with the user. Phases 2–8 of the spec (automation, community research, governance) remain the long-term roadmap, recorded in `docs/roadmap.md`, unchanged.

---

## CLAUDE.md contents (to be written in Milestone 0, step 2)

Concise (~1 page), containing:

- **What this is**: one paragraph + pointer to MANIFESTO.md / METHODOLOGY.md.
- **Non-negotiable project rules** (the ones an AI or contributor could silently violate):
  - Never present uncertain ownership as fact; all published claims trace to sources; Tier 4 evidence never supports a published claim.
  - All user-facing ownership language comes from the reviewed copy module — never ad-hoc strings.
  - Badge labels are enum values; red ≠ private equity, red = data-quality dispute.
  - Channels are identified by immutable YouTube channel ID, never display name.
  - Extension sends only channel ID + extension version; no browsing data, no telemetry by default.
  - Every DB mutation goes through the audit middleware.
  - LLMs draft, humans publish — no automated publication path, ever.
  - Precision over recall: a missed acquisition is fine; a false accusation is not.
- **Stack + layout**: pnpm/Turborepo map of apps/services/packages, TS-only, Hono/Drizzle/Zod/Next.js/Vite.
- **Commands**: `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm import:research`, `docker compose up`.
- **Conventions**: Zod schemas in packages/schemas are the single source of truth; pure logic in packages/{graph,scoring} with unit tests; TDD for scoring/graph/resolver; selectors centralized in `apps/extension/src/content/selectors.ts`.
- **Where things live**: docs index, research YAML format pointer, plan/roadmap location.

---

## Verification

- **Milestone 0**: `pnpm install && pnpm build && pnpm test` green in fresh clone; CI passes; schemas package round-trips the example channel record from spec §35.
- **Milestone 1**: importer loads pilot YAML → Postgres; `packages/graph` derives `PE_BACKED` for the §35 example graph; scoring reproduces the §14.2 worked example (0.884).
- **Milestone 2**: `docker compose up`, load extension unpacked, visit a seeded channel → badge renders; panel shows evidence + disclaimer; unknown channel → neutral badge; API returns §17.2-shaped JSON; selector-health suite passes against snapshots.
- **Milestone 3**: end-to-end: draft claim → review approval → published → visible in extension within cache TTL; correction submission → appears in review inbox → resolution audited.

## Execution notes

- First action on approval: confirm directory naming (modification #8), `git init`, scaffold, then CLAUDE.md + docs before any application code.
- Use superpowers TDD + verification-before-completion skills during implementation; writing-plans skill will produce the detailed per-task implementation plan for Milestone 0/1 once this high-level plan is approved.
