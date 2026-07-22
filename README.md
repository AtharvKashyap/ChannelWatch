# CHANNELWATCH

Know who is behind the channel.

## Status

Milestone M2 (public API + Chrome extension) complete. The repository contains:
the monorepo tooling and founding documents; the data layer — taxonomy and Zod
schemas (`packages/schemas`), confidence scoring (`packages/scoring`), the
ownership-classification engine (`packages/graph`), PostgreSQL
schema/migrations/seed and the public read API (`services/api`), the YAML
research-record importer with 12 researched channel records
(`data/research/`); and the Manifest V3 Chrome extension (`apps/extension`)
that shows ownership badges and an evidence panel on YouTube watch and channel
pages. See `apps/extension/README.md` for build/load and the local
end-to-end workflow. Next (M3): reviewer console, ~100-channel dataset,
launch prep.

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
