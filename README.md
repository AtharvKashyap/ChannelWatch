# CHANNELWATCH

Know who is behind the channel.

## Status

Pre-MVP, milestone M1 (data core). The repository contains the monorepo
tooling, the project's founding documents, and the data layer: taxonomy and
Zod schemas (`packages/schemas`), confidence scoring (`packages/scoring`),
the ownership-classification engine (`packages/graph`), the PostgreSQL
schema/migrations/seed (`services/api`), and the YAML research-record
importer (`data/research/`). The browser extension and public API endpoints
arrive in M2.

## Quickstart

```
pnpm install
docker compose up
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
