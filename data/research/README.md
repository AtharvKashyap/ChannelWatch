# Research records

This directory holds CHANNELWATCH's seed-phase ownership research: **one YAML
file per channel**. Each file is a `ResearchRecord` (schema:
`@channelwatch/schemas`, `src/research.ts`) capturing a channel, the entities in
its ownership graph, the relationships between them, the evidence backing those
relationships, and the review provenance.

This is the trust-critical publication path. The evidence standards these files
encode are summarized in
[`docs/research-authoring-prompt.md`](../../docs/research-authoring-prompt.md);
read it before authoring a record.

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
   upserts the result. After all files are imported it runs a **whole-graph
   recompute** of every channel's cached `published_classification`, re-deriving
   each label over the channel's full connected sub-graph (the same view the API
   serves) so the cached labels stay consistent when a record shares entities
   with another. It is idempotent: re-importing an unchanged file writes nothing
   (and adds no audit rows), and the recompute rewrites only labels that changed.

## Recording an ownership transition

Ownership **history** — who owns the channel, when, and who owned it before — is
derived from the relationship edges' dates and lifecycle status. There is **no
separate "former owner" column**; a prior owner is simply an ownership edge whose
`effective_to` is in the past (and whose `status` is `ENDED`).

When a new owner supersedes a prior one:

1. **On the superseded owner's edge**, set `effective_to` to the operative
   handover date and `status: ENDED`. It becomes a prior period — surfaced in the
   "Ownership over time" history, never marked current.
2. **On the new owner's edge**, set `effective_from` to the **same operative
   date**, leave `effective_to: null`, and keep `status: ACTIVE`. This is the
   current period.

`effective_from` is the **operative** date — when ownership actually changed —
**not** the announcement date. Record the acquiring entity as the new edge's
`subject`. Capture the **announcement** date on the supporting source's
`published_at`, not on the relationship (the operative and announcement dates
often differ; conflating them would misdate the transition).

Because the classifier reads only currently-active edges, adding history has **no
effect on the served classification** — it only enriches the history surface.

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
