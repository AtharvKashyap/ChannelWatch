# CHANNELWATCH

Know who is behind the channel.

## Status

Milestone M3 core (temporal ownership + web app) complete. The repository
contains: the monorepo tooling and founding documents; the data layer —
taxonomy and Zod schemas (`packages/schemas`), confidence scoring
(`packages/scoring`), the ownership-classification engine with temporal
ownership-history derivation (`packages/graph`), PostgreSQL
schema/migrations/seed, the public read API, and authed reviewer endpoints
with session auth and a two-person review rule (`services/api`); the YAML
research-record importer (whole-graph recompute is the single writer of
cached classifications) with 17 researched channel records
(`data/research/`); the Manifest V3 Chrome extension (`apps/extension`) that
shows ownership badges and an evidence panel — including "Ownership over
time" — on YouTube watch and channel pages; and the Next.js web app
(`apps/web`) with the public site (channel pages with ownership chain +
history, search, methodology, correction form) and the authed `/review`
console (claim queue, entity CRUD, correction inbox, audit viewer). See
`apps/extension/README.md` for build/load and the local end-to-end workflow.
Remaining for M3: dataset expansion toward ~100 verified channels and
launch prep (legal review, store listing, reproducible build).

## Quickstart

Requires Node ≥ 20 and pnpm 9 (`brew install pnpm`, or use `npx pnpm@9` as a
drop-in for every `pnpm` command below — no other environment setup needed).

```
pnpm install
docker compose up -d postgres
export DATABASE_URL='postgres://channelwatch:channelwatch@localhost:5432/channelwatch'
pnpm db:migrate && pnpm import:research
pnpm dev
```

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — project conventions and non-negotiable rules
- [`docs/SPEC.md`](./docs/SPEC.md) — founding spec
- [`docs/plan.md`](./docs/plan.md) — approved build plan
- [`MANIFESTO.md`](./MANIFESTO.md) — project vision and purpose
- [`PRIVACY.md`](./PRIVACY.md) — privacy principles
- [`SECURITY.md`](./SECURITY.md) — security guidelines
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — contribution guidelines
- [`docs/METHODOLOGY.md`](./docs/METHODOLOGY.md) — research methodology
- [`docs/evidence-policy.md`](./docs/evidence-policy.md) — evidence standards
- [`docs/legal-risk.md`](./docs/legal-risk.md) — legal risk assessment
- [`docs/data-model.md`](./docs/data-model.md) — data model specification
- [`docs/roadmap.md`](./docs/roadmap.md) — project roadmap
