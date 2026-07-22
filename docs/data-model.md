# CHANNELWATCH Data Model (MVP)

This document describes the MVP data model, adapted from Spec §15–§16 as resolved
by `plan.md` modification #5. It defines the tables, the ownership-graph
vocabulary, and — most importantly — the architectural rule that keeps
classifications explainable and defamation-safe.

---

## The Core Architectural Rule

> **Claims are the review-workflow artifact. Relationships are the published
> artifact. Classification is computed from active relationships via graph
> traversal and cached with explanation codes — never stored as unexplained
> truth.** (Plan modification #5; Spec §7, §26.2, §40.5.)

Concretely:

- A **claim** is a discrete, sourced assertion (e.g. "Entity A ACQUIRED Channel
  B") that moves through the review lifecycle (`DRAFT → UNDER_REVIEW → PUBLISHED
…`, Spec §8.3). Claims are what reviewers approve, dispute, correct, and retract.
- A **relationship** is what a published, approved claim produces. The set of
  **active** relationships (those whose `effective_from`/`effective_to` window
  covers the current date and whose status is published) is the graph the
  classifier reads.
- A **classification** (e.g. `PE_BACKED`) is **derived** by traversing active
  relationships to the ultimate parent — it is never entered by hand. The result
  is cached on `channels.published_classification` alongside
  `classification_confidence` and machine-readable **explanation codes** (e.g.
  `DIRECT_OWNER_CONFIRMED`, `OWNER_IS_PE_PORTFOLIO_COMPANY`, Spec §26.2). The cache
  is a denormalization for read performance; the explanation codes make it
  auditable. It must never be treated as a free-standing fact divorced from the
  relationships that produced it.

This separation is why the classifier can always answer "why does this label
appear?" — a founding requirement (Spec §3.2, §4). Traversal and derivation live
in `packages/graph`; confidence math and thresholds live in `packages/scoring`.

---

## Tables (Spec §16; `plan.md` modification #5)

The MVP schema (Drizzle over PostgreSQL) comprises:

| Table                 | Role                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `channels`            | YouTube channels, keyed by immutable `youtube_channel_id`; holds the cached `published_classification`, `classification_confidence`, and `last_reviewed_at`. |
| `entities`            | Canonical organizations and persons (companies, funds, PE firms, creators…).                                                                                 |
| `entity_aliases`      | Alternate names/spellings resolving to a canonical entity (entity resolution, Spec §12.4).                                                                   |
| `relationships`       | **The published artifact.** Typed, time-bounded edges between channels and entities; the classifier's input.                                                 |
| `sources`             | Evidence items with tier, type, content hash, archive URL, and status (Spec §8.2).                                                                           |
| `claims`              | **The review-workflow artifact.** Sourced assertions moving through the claim lifecycle (Spec §8.3).                                                         |
| `claim_sources`       | Join table linking claims to the sources that support them, with support type and quoted excerpt.                                                            |
| `reviews`             | Reviewer decisions and reasoning per claim (Spec §20.2).                                                                                                     |
| `correction_requests` | Public correction/appeal submissions and their resolution (Spec §23.3, §24).                                                                                 |
| `audit_events`        | Immutable who/what/when/why record for every material change (Spec §26.5).                                                                                   |
| `reviewers`           | Reviewer accounts and authentication (added by `plan.md`; the classifier and audit trail reference `reviewer_id`).                                           |

Every mutation writes an `audit_events` record; published records are never
silently edited (Spec §23.3, §26.5).

---

## Ownership Graph Vocabulary

### Node Types (Spec §15.1)

```text
CHANNEL
CREATOR
PERSON
COMPANY
SUBSIDIARY
MEDIA_NETWORK
INVESTMENT_FIRM
PRIVATE_EQUITY_FIRM
VENTURE_CAPITAL_FIRM
FUND
BRAND
TRUST
NONPROFIT
UNKNOWN_ENTITY
```

### Relationship Types (Spec §15.2)

```text
OWNS
PARTIALLY_OWNS
CONTROLS
OPERATES
MANAGES
FUNDS
INVESTED_IN
ACQUIRED
MERGED_WITH
LICENSES_FROM
REPRESENTS
FOUNDED_BY
HOSTED_BY
EMPLOYS
SUBSIDIARY_OF
PORTFOLIO_COMPANY_OF
CREATIVE_CONTROL_BY
DISTRIBUTED_BY
AD_SALES_BY
FORMERLY_OWNED_BY
```

These types keep investment, ownership, operational control, and creative
influence as distinct edges — the model must never confuse investment with
ownership, or ownership with editorial control (Spec §40.1–40.2).

### Relationship Properties (Spec §15.3)

```text
effective_from
effective_to
ownership_percentage
control_level
confidence
source_ids
review_status
notes
```

`effective_from` / `effective_to` bound a relationship in time, so the classifier
reads only edges active on the current date (a subsequent resale supersedes rather
than overwrites the prior edge). `source_ids` ties every published edge back to
inspectable evidence, and `confidence` carries the score from `packages/scoring`.

---

## Related documents

- `METHODOLOGY.md` — evidence tiers, scoring model, review workflow.
- `evidence-policy.md` — source and claim status lifecycles, Tier 4 rule.
- `SPEC.md` §16 — the illustrative column-level SQL for each table.
