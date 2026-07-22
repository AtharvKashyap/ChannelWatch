# Research records

This directory holds CHANNELWATCH's seed-phase ownership research: **one YAML
file per channel**. Each file is a `ResearchRecord` (schema:
`@channelwatch/schemas`, `src/research.ts`) capturing a channel, the entities in
its ownership graph, the relationships between them, the evidence backing those
relationships, and the review provenance.

This is the trust-critical publication path. The evidence standards these files
encode are defined in [`docs/METHODOLOGY.md`](../../docs/METHODOLOGY.md); read it
before authoring a record.

## Workflow

1. **Author.** Copy [`_TEMPLATE.yaml`](./_TEMPLATE.yaml) to
   `<channel-slug>.yaml` and fill it in. Declare every entity, wire relationships
   and claims to those entities by `slug` (or the literal `"channel"`), and
   attach at least one supporting source to every relationship.
2. **Review (PR).** Open a pull request. A second researcher reviews the sources
   and the claims they support. Evidence quality — not opinion — decides what
   gets published.
3. **Import.** On merge, run:

   ```bash
   export DATABASE_URL='postgres://channelwatch:channelwatch@localhost:5432/channelwatch'
   pnpm import:research
   ```

   The importer validates every file, enforces the evidence rules below,
   **computes** the ownership classification with `@channelwatch/graph`, and
   upserts the result. It is idempotent: re-importing an unchanged file writes
   nothing (and adds no audit rows).

## What the importer enforces

- **Tier agreement.** A source's `tier` must match the tier implied by its
  `source_type` (SPEC §7.1 / §14.1). You cannot manually inflate a source's tier.
- **Every relationship is supported.** Each relationship needs at least one
  supporting source.
- **Tier 4 never backs a published edge.** Tier 4 sources are "leads only"; a
  relationship with `status: ACTIVE` may not be supported by a Tier 4 source.
- **PE labels need qualifying evidence.** A PE-implying relationship
  (`PORTFOLIO_COMPANY_OF`, or an endpoint that is a `PRIVATE_EQUITY_FIRM`) must
  satisfy the §14.3 rule over its supporting sources: **one Tier 1 source, or two
  Tier 2 sources from independent publishers**. Import fails loudly otherwise.
- **Classification is computed, never asserted.** These files contain no
  classification field; the label and its confidence are derived from the
  relationships at import time.

Every insert or update writes an `audit_events` row with before/after state.
Unchanged rows are not rewritten and produce no audit noise.

## Fixtures

Files with `fixture: true` are fictional examples/tests. The importer skips them
unless run with `--include-fixtures`:

```bash
pnpm import:research -- --include-fixtures
```

[`example-channel.yaml`](./example-channel.yaml) is the fixture reproducing SPEC
§35; importing it derives `PE_BACKED`.
