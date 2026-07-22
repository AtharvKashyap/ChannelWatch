# CHANNELWATCH Roadmap

Two views of the plan. The **execution milestones (M0–M3)** are the near-term,
committed build sequence from `plan.md`. The **long-term phases (2–8)** summarize
the founding spec's development roadmap (Spec §27); they remain the direction of
travel and are recorded here unchanged in intent.

Where the spec and the plan differ, the plan wins (see `SPEC.md` preamble): the
backend is TypeScript (Hono/Drizzle/PostgreSQL), the reviewer console is merged
into `apps/web`, and queues/object storage/graph DB are deferred until scale
demands them.

---

## Execution Milestones (from `plan.md`)

### M0 — Foundation

Monorepo scaffold (pnpm + Turborepo, CI, docker-compose, `.env.example`);
`CLAUDE.md`; the constitution docs (this document set); and `packages/schemas`
(all enums + Zod schemas + reviewed copy module). Corresponds to Spec Phase 0.

### M1 — Data core

`services/api` skeleton + Drizzle schema, migrations, and seed script;
`packages/scoring` (confidence formula §14.2, thresholds §14.3, explanation codes)
and `packages/graph` (traversal, ultimate parent, classification derivation §26.2)
as pure, heavily-tested functions; the YAML research-record format + validator +
importer (`data/research/`); and **5 pilot channels** researched to pressure-test
the taxonomy before UI work.

### M2 — API + extension

Public read endpoints + rate limiting + audit middleware; corrections POST;
the Chrome extension (channel resolver, badge on channel + watch pages, ownership
panel with evidence + disclaimer, settings, local cache with Spec §18.6 TTLs,
fail-silent DOM handling); and the selector-health test suite against stored
YouTube HTML snapshots.

### M3 — Review + launch prep

The `/review` console (claim queue, approve/reject with reasoning, entity CRUD,
correction inbox, audit viewer, two-person-review flag for sensitive claims per
§20.3); dataset expansion to ~25 then ~100 balanced channels (§37.3); public site
(channel pages, methodology page, correction form); and the pre-launch checklist
(legal review §23.4, Chrome Web Store listing, privacy policy, reproducible build).

M1 corresponds to Spec Phase 1 (Manual Dataset MVP); M2–M3 begin drawing on
Phases 2–3 (research workflow surfaces, broader extension coverage).

---

## Long-Term Phases (Spec §27)

### Phase 2 — Research Workflow

Research queue, source submission system, entity-resolution interface, claim
review workflow, audit history, source-archive support, two-person approval for
sensitive claims, and a public methodology page.

### Phase 3 — Broader YouTube Coverage

Badges on search pages, homepage, and subscription feed; Shorts and playlist
support; local caching; a Firefox build; and extension settings.

### Phase 4 — Automated Discovery

Corporate press-release monitor, portfolio-page monitor, news candidate collector,
channel-website scanner, historical-page comparison, and automated **draft** claim
extraction — always with a human-review requirement (LLMs draft, humans publish).

### Phase 5 — Ownership Graph

Multi-level parent tracing, private-equity portfolio mapping, historical ownership
timeline, creator-involvement modeling, minority-vs-controlling investment
distinction, and relationship visualization.

### Phase 6 — Community Research

Verified researcher accounts, source-contribution workflow, reputation based on
accepted evidence, moderation controls, abuse prevention, public research notes,
and claim discussion pages.

### Phase 7 — Public Data Platform

Public dataset export, versioned releases, research API, bulk lookup, academic
documentation, data provenance, and historical snapshots.

### Phase 8 — Sustainable Governance

Nonprofit / public-benefit governance evaluation, an independent review board, a
conflict-of-interest policy, funding transparency, annual methodology review, and
public correction and accuracy reports.
