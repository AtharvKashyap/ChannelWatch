# Milestone 0 — Foundation: Implementation Plan

Executes Milestone 0 of `docs/plan.md` for CHANNELWATCH. Repo root: this repository
(`YT_Channel_Watch`, package namespace `channelwatch`). CLAUDE.md, docs/SPEC.md, and
docs/plan.md already exist and are committed.

## Global Constraints

- TypeScript-only monorepo: pnpm workspaces + Turborepo. Node >= 20. Package names scoped `@channelwatch/*`.
- Nothing here builds application features yet — M0 is scaffold, constitution docs, and the schemas package only.
- Git commits: plain descriptive messages, **no Co-Authored-By or generated-with trailers**.
- All taxonomies, enum values, thresholds, and wording MUST match `docs/SPEC.md` exactly where the spec defines them (sections cited per task). Do not invent new enum members or rename spec values.
- Legal-safe language rules (SPEC §23.1): user-facing copy never asserts editorial control, never uses "sold out", always distinguishes fact from interpretation.
- Badge color semantics (SPEC §9.2): red = disputed/data-quality conflict, orange = PE-backed. Never map red to private equity.
- Precision over recall; uncertainty must be representable (UNKNOWN is a first-class value everywhere).

---

## Task 1: Monorepo scaffold

Create the workspace skeleton and tooling. **No application code.**

Files to create at repo root:

- `package.json` — private root, `"name": "channelwatch"`, packageManager pnpm (latest 9.x), scripts: `dev`, `build`, `test`, `lint`, `format`, `typecheck` (all via `turbo run …`), plus `db:migrate`, `db:seed`, `import:research` stubs that echo "not implemented until M1" and exit 0.
- `pnpm-workspace.yaml` — workspaces: `apps/*`, `services/*`, `packages/*`.
- `turbo.json` — tasks: `build` (dependsOn `^build`, outputs `dist/**`), `test` (dependsOn `^build`), `lint`, `typecheck` (dependsOn `^build`), `dev` (cache false, persistent).
- `tsconfig.base.json` — strict: true, ES2022 target, `moduleResolution: "bundler"`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`.
- `.gitignore` — node_modules, dist, .turbo, .env, coverage, .DS_Store, .superpowers/.
- `.env.example` — `DATABASE_URL=postgres://channelwatch:channelwatch@localhost:5432/channelwatch`, `API_PORT=8787`, `WEB_PORT=3000`, comment header explaining no secrets are committed.
- `.editorconfig`, `.prettierrc` (default prettier, no semicolons opinion — use defaults + `"printWidth": 100`), `eslint.config.mjs` (flat config, typescript-eslint recommended, prettier-compatible).
- `docker-compose.yml` — one service for MVP dev: `postgres:16-alpine` with env matching `.env.example`, volume, healthcheck. Include commented-out `api`/`web` service blocks noting "enabled in M1/M2".
- `.github/workflows/ci.yml` — on push/PR: pnpm setup (corepack), install, `turbo run lint typecheck test build`. Use actions/checkout@v4, actions/setup-node@v4 with pnpm cache.
- `README.md` — project one-liner ("Know who is behind the channel"), status (pre-MVP, M0), quickstart (pnpm install / docker compose up / pnpm dev), pointer to CLAUDE.md, docs/SPEC.md, docs/plan.md, and the constitution docs. Neutral, factual tone.
- Empty workspace dirs kept via `.gitkeep`: `apps/`, `services/`, `packages/`, `data/research/`.

Verification: `pnpm install` succeeds; `pnpm lint` and `pnpm build` run (trivially green with no packages); `docker compose config` validates. Commit when green.

## Task 2: Constitution docs

Write the project's governing documents, **adapted from `docs/SPEC.md`** (read it first —
it is the source of truth; these docs restructure its content, they don't invent policy).
Tone: neutral, precise, public-facing. No marketing language.

Files:

- `MANIFESTO.md` — SPEC §4 essentially verbatim (light copyedit only).
- `docs/METHODOLOGY.md` — the research constitution: evidence hierarchy Tiers 1–4 (§7.1, exact tier contents), confidence levels and statuses (§8), evidence weights table + confidence formula + publication thresholds (§14, exact numbers incl. the 0.90/0.75/0.55/0.30 bands and the PE-label rule: ≥1 Tier 1 source OR 2 independent Tier 2 sources + strong entity resolution), review checklist (§20.2), two-person review triggers (§20.3), LLM usage rules (§21, both appropriate and prohibited uses).
- `docs/evidence-policy.md` — what counts as evidence, source status lifecycle (§8.2), claim status lifecycle (§8.3), Tier 4 "leads only" rule, creator-safety exclusions (§22.4).
- `docs/legal-risk.md` — §23 in full: safer-language table (prefer/avoid pairs verbatim), fact-vs-interpretation display rule, correction policy, pre-launch legal review checklist (§23.4).
- `docs/data-model.md` — the MVP data model per `docs/plan.md` modification #5: tables list (channels, entities, entity_aliases, relationships, sources, claims, claim_sources, reviews, correction_requests, audit_events, reviewers); the key architectural rule stated prominently: **claims are the review-workflow artifact, relationships are the published artifact, classification is computed from active relationships via graph traversal and cached with explanation codes — never stored as unexplained truth.** Include node types (§15.1) and relationship types (§15.2) verbatim, relationship properties (§15.3).
- `docs/roadmap.md` — phases 2–8 from SPEC §27 summarized, plus the M0–M3 milestone plan from docs/plan.md.
- `PRIVACY.md` — §22: extension sends only channel ID + extension version + data version; the never-collect list; telemetry opt-in rules.
- `SECURITY.md` — threat model summary (§32) + how to report vulnerabilities (security@ placeholder + GitHub private advisories).
- `CONTRIBUTING.md` — §31: code vs research contributions; research contributions require source verification, reviewer approval, neutral wording, audit logging; commit-message convention (plain messages, no trailers); pnpm/turbo dev workflow.

Verification: every numeric threshold and enum list cross-checked against SPEC (cite section numbers inline in the docs, e.g. "(Spec §14.3)"). Commit when done.

## Task 3: `packages/schemas` — taxonomy, Zod schemas, copy module (TDD)

Create `packages/schemas` as `@channelwatch/schemas`, the single source of truth. Vitest + TDD: write failing tests first, then implement.

Structure:

- `package.json` (`@channelwatch/schemas`, type module, exports `./dist/index.js` + types, scripts build (tsc), test (vitest run), dev), `tsconfig.json` extending base, `vitest.config.ts`.
- `src/enums.ts` — as const arrays + derived union types + Zod enums for ALL of (values exactly as in SPEC):
  - `EntityType` (§15.1, 14 values CHANNEL…UNKNOWN_ENTITY — note CHANNEL/CREATOR are node types; keep all)
  - `RelationshipType` (§15.2, 20 values OWNS…FORMERLY_OWNED_BY)
  - `EvidenceStatus` (§8.2: ACTIVE, SUPERSEDED, RETRACTED, DISPUTED, ARCHIVED, BROKEN_LINK, PENDING_REVIEW)
  - `ClaimStatus` (§8.3: DRAFT, UNDER_REVIEW, PUBLISHED, DISPUTED, CORRECTED, RETRACTED, ARCHIVED)
  - `ConfidenceLabel` (§8.1: CONFIRMED, HIGH, MODERATE, LOW, DISPUTED, UNKNOWN)
  - `ClassificationLabel` (§9.1 mapped to codes: INDEPENDENT, CREATOR_OWNED, EXTERNALLY_FUNDED, CORPORATE_OWNED, PE_BACKED, OWNERSHIP_CHANGED, OWNERSHIP_UNCLEAR, DISPUTED)
  - `BadgeColor` (§9.2: NEUTRAL, GREEN, BLUE, PURPLE, ORANGE, RED)
  - `SourceTier` (1 | 2 | 3 | 4)
  - `ResearchStatus` (§20.1, 10 values UNRESEARCHED…ARCHIVED)
  - `ControlLevel` (CONTROLLING, MINORITY, MANAGEMENT, LICENSE, UNKNOWN)
  - `CreatorStatus` (§6.5 mapped to codes: OWNER_OPERATOR, OWNER_EXTERNAL_MGMT, MAJORITY_OWNER, MINORITY_OWNER, HOST_NOT_IN_CONTROL, REMAINS_HOST, EXITED, UNCLEAR, CORPORATE_BRAND)
- `src/classification.ts` — pure map `classificationToBadgeColor` per §9.2: UNKNOWN/unresearched→NEUTRAL, INDEPENDENT/CREATOR_OWNED→GREEN, EXTERNALLY_FUNDED→BLUE, CORPORATE_OWNED→PURPLE, PE_BACKED→ORANGE, DISPUTED→RED, OWNERSHIP_CHANGED/OWNERSHIP_UNCLEAR→NEUTRAL. **Test explicitly: PE_BACKED must NOT be RED.**
- `src/confidence.ts` — `confidenceLabelFromScore(score)` per §14.3 bands (≥0.90 CONFIRMED, ≥0.75 HIGH, ≥0.55 MODERATE, ≥0.30 LOW, else research-lead/UNKNOWN); exported `PUBLICATION_THRESHOLD = 0.30` (below = research lead only, not publishable) and `CACHE_TTLS` (§18.6: confirmed 7d, recentlyChanged 6h, unknown 24h, apiError 10m, disputed 1h — milliseconds).
- `src/schemas.ts` — Zod schemas: `YoutubeChannelId` (regex `^UC[A-Za-z0-9_-]{22}$`), `Channel`, `Entity`, `Relationship` (with effective_from/to, ownership_percentage nullable, control_level, confidence 0–1, source_ids), `Source` (url, tier, status, archive_url, content_hash…), `Claim`, `ChannelLookupResponse` matching SPEC §17.2 example shape exactly (classification{label,confidence,confidence_label,summary}, direct_owner, ultimate_parent, creator_status, last_reviewed_at, evidence_count, disputed).
- `src/copy.ts` — the ONLY place user-facing ownership strings live: badge display text per label ("Independent", "Creator-Owned", "Externally Funded", "Corporate-Owned", "PE-Backed", "Ownership Changed", "Ownership Unclear", "Disputed"), the standing disclaimer string exactly: "No conclusion is made about editorial interference.", correction CTA "Report an Error", and templated neutral summary helpers that follow §23.1 safer language (e.g. ownedBy(channel, owner), portfolioCompanyOf(owner, sponsor), undisclosedStake(creator)). No function may produce the phrases "sold out" or assert editorial control.
- `src/index.ts` — barrel export.

Tests (write FIRST, in `tests/`): enums match spec lists exactly (assert full arrays), badge-color map incl. the PE≠RED rule, confidence band edges (0.90, 0.75, 0.55, 0.30, 0.299, 1.0), YoutubeChannelId accepts `UC` + 22 chars and rejects handles/names, ChannelLookupResponse parses the §17.2 example JSON verbatim (copy it into a fixture), copy module contains the exact disclaimer and no banned phrases.

Verification: `pnpm --filter @channelwatch/schemas test` green, `pnpm build` green, `pnpm lint` green. Commit when green.
