# Track A — Temporal Ownership Enrichment (M3)

**Date:** 2026-07-23
**Status:** Approved (design), pending implementation
**Milestone:** M3

## Problem

The platform already _stores_ temporal ownership data — `relationships` carry
`effective_from` / `effective_to`, relationship types include `ACQUIRED`, and
`getTimeline()` already assembles dated relationship + claim events. But the
user-facing surfaces only ever show the **current** owner plus a terse "since
{date}" suffix on each ownership-chain hop. A viewer cannot see the ownership
_history_: **who came to own the channel, when, and who held it before**.

This track surfaces a legal-safe ownership history across the lookup payload and
the extension panel. It **reuses the existing temporal data model** — it does not
introduce a parallel one.

## Goal

Surface "who owns/acquired the channel, when, and who owned it before" as neutral,
evidence-first, legal-safe text — with dates shown only when documented and
percentages shown only when publicly disclosed.

## Scope (this spec)

1. **Derivation (`packages/graph`)** — a pure function `ownershipHistory(...)`
   producing an ordered list of ownership _periods_ from a channel's connected
   relationships. It includes only ownership/control/founding edges
   (`OWNS`, `PARTIALLY_OWNS`, `ACQUIRED`, `INVESTED_IN`, `FOUNDED_BY`,
   `CREATOR_OWNED`-producing edges); it excludes non-ownership edges such as
   `HOSTED_BY` (those remain on the fuller `/timeline` stream). Each entry:
   `{ name, type, relationship, control_level, ownership_percentage|null,
effective_from|null, effective_to|null, is_current }`. `is_current` = the
   effective window covers today (or the edge is open-ended and not superseded).
   Ordered newest-first (most recent transition at top).

2. **Schema (`packages/schemas`)** — add `OwnershipHistoryEntry` and an optional
   `ownership_history: OwnershipHistoryEntry[]` field on the researched lookup
   payload (`LookupPayload`). Optional + additive so the pristine SPEC §17.2
   fixture still round-trips 1:1 (same discipline used for `ownership_chain`).
   `ownership_chain` (current owners, channel→upward) is unchanged.

3. **API assembler (`services/api`)** — populate `ownership_history` on the
   researched lookup payload by calling the new graph function against the
   channel's connected relationships. No new endpoint; the extension gets history
   in the existing single lookup call.

4. **Copy (`packages/schemas/src/copy.ts`)** — neutral, legal-safe phrasing for
   history lines, built on the existing `ownershipMechanismText()`. Additions to
   `CHAIN_COPY`: `previouslyPrefix` ("previously"), `currentLabel` ("current"),
   `dateRangeSeparator` ("–"), `dateUndisclosed` ("date not publicly disclosed").
   No free-text; all phrasing flows through the reviewed copy module.

5. **Extension panel (`apps/extension`)** — an "Ownership over time" section under
   the current-owner chain, rendering `ownership_history` newest→oldest, each line
   legal-safe (mechanism + entity + date range when present, `dateUndisclosed`
   when absent), current entry marked. Section is omitted entirely when history is
   empty or absent (fail-silent, consistent with existing panel behavior). The
   standing `EDITORIAL_DISCLAIMER` remains.

6. **Research-record conventions (`data/research/_TEMPLATE.yaml` + README)** —
   document how to record an ownership **transition**: when a new owner supersedes
   a prior one, set `effective_to` on the superseded edge and `effective_from` on
   the new edge; record the acquiring entity, the operative `effective_from`, and
   the announcement date via the supporting source's `published_at`. **No new
   relationship column** — `effective_from` is the operative date; announcement
   dates live on sources. A prior owner is simply an ownership edge whose
   `effective_to` is in the past; the classifier already reads only currently-active
   edges, so history has no effect on the served classification.

7. **Whole-graph recompute (flagged M3 wart)** — the importer caches a per-record
   label while the API serves a whole-graph recompute; fold a post-import
   whole-graph recompute of the cached `published_classification` column into this
   track, since it lives in the same graph/assembler area and keeps cached labels
   honest for the growing dataset.

## Data flow

```
relationships (effective_from/to, type, control_level, %)
   → packages/graph: ownershipHistory()  [pure]
   → services/api assembler: LookupPayload.ownership_history
   → extension panel: "Ownership over time" section  (copy module phrasing)
```

## Legal-safety constraints (docs/legal-risk.md §23)

- Neutral, non-editorializing phrasing; the editorial-interference disclaimer stays.
- Percentages only when publicly disclosed (`ownership_percentage` non-null).
- Dates surfaced only when present; otherwise `dateUndisclosed`, never inferred.
- Badge labels + mechanism phrasing come from fixed enums / the reviewed copy module.

## Testing (TDD)

- `packages/graph`: unit tests for `ownershipHistory()` — single owner; multiple
  owners over time (prior with `effective_to`, current open-ended); null dates;
  undisclosed percentage; creator founding edge; multi-hop PE chain
  (e.g. Moonbug → Candle Media). Ordering and `is_current` correctness.
- `packages/schemas`: `OwnershipHistoryEntry` round-trip; §17.2 fixture still
  round-trips with the field absent.
- `services/api`: DB-mode acceptance — history populated and ordered for a
  researched channel with a transition.
- `apps/extension`: panel renders the history section; omitted when empty; dates
  vs. `dateUndisclosed`; disclaimer present.

## Out of scope

- Graphical timeline visualization — Track C (public site channel page).
- Announced-vs-effective date distinction as a first-class field (use source
  `published_at`).
- Historical snapshot diffing / versioned history (Phases 4/5/7).
