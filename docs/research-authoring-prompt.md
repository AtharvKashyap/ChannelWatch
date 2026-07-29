# Research authoring guide + agent prompt

Everything you need to research a channel and produce a record the importer will
accept. Pair this with [`data/research/README.md`](../data/research/README.md)
(the authoring + review workflow).

## Where the file goes

- **One YAML file per channel** in `data/research/`, named `<channel-slug>.yaml`
  (kebab-case, e.g. `data/research/marques-brownlee.yaml`).
- Copy [`data/research/_TEMPLATE.yaml`](../data/research/_TEMPLATE.yaml) as your
  starting point; a finished example is
  [`data/research/little-baby-bum.yaml`](../data/research/little-baby-bum.yaml).
- The schema that validates it is `packages/schemas/src/research.ts`. The label
  (CREATOR_OWNED, PE_BACKED, …) is **computed on import — never write it.**

## What to gather

1. **The canonical channel ID** — `UC` + 22 characters (24 total), NOT the
   `@handle`. Get it from the channel page source: the `externalId` field or the
   canonical `/channel/UC…` URL. This is the primary key; a wrong ID means the
   record attaches to nothing.
2. **The ownership chain, bottom-up** — who owns the channel, who owns that
   entity, up to the ultimate parent. For each entity capture: canonical name,
   `entity_type`, and if available `legal_name`, `jurisdiction`, `website`,
   `aliases`.
3. **Each ownership edge** — the relationship type, control level, ownership %
   (only if a source states it), the operative date it took effect, a confidence
   0–1, and lifecycle status.
4. **At least one source per edge** — url, title, publisher, the type + tier, an
   optional archive URL, a ≤500-char verbatim excerpt that establishes the edge,
   and which relationship index it supports.

## The rules the importer enforces (validation fails otherwise)

- **Full dates only.** `effective_from`/`effective_to` must be `YYYY-MM-DD`. If
  you only know month or year, **omit the field** — never write `2018-09`. Put
  the announcement date on the source's `published_at`; the operative date (when
  ownership actually changed) on the relationship's `effective_from`.
- **Tier must match source_type** (you cannot inflate a tier):

  | Tier                     | source_type values                                                                                                                                          |
  | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | **1** (primary)          | `OFFICIAL_REGULATORY_FILING`, `OFFICIAL_ACQUISITION_ANNOUNCEMENT`, `INVESTOR_PORTFOLIO_LISTING`, `DIRECT_CREATOR_CONFIRMATION`, `CORPORATE_REGISTRY_RECORD` |
  | **2** (strong secondary) | `REPUTABLE_BUSINESS_PUBLICATION`, `ESTABLISHED_INDUSTRY_PUBLICATION`, `NAMED_EXECUTIVE_INTERVIEW`                                                           |
  | **3** (supporting)       | `ARCHIVED_CORPORATE_PAGE`, `TRADEMARK_TRANSFER`, `SHARED_LEGAL_DOCUMENTATION`, `TECHNICAL_INFRASTRUCTURE_LINKAGE`                                           |
  | **4** (leads only)       | `ANONYMOUS_TIP`, `BEHAVIORAL_CONTENT_CHANGE`                                                                                                                |

- **Every relationship needs ≥1 supporting source.**
- **Tier 4 can never back a published (`status: ACTIVE`) edge** — leads only.
- **PE labels need qualifying evidence.** A PE-implying edge
  (`PORTFOLIO_COMPANY_OF`, or an endpoint typed `PRIVATE_EQUITY_FIRM`) must have
  **one Tier 1 source, or two Tier 2 sources from independent publishers**.
- **Excerpts ≤ 500 characters**, verbatim.
- **`reviewed_by` is what publishes a record.** Leave it **absent** (not `null`)
  until a human has verified it. Set it (plus `last_reviewed_at`) only after real
  review. Sensitive records (PE chains, named private individuals) need a
  **second, distinct** reviewer before public launch.

## Allowed enum values

- **`entity_type`**: `CHANNEL`, `CREATOR`, `PERSON`, `COMPANY`, `SUBSIDIARY`,
  `MEDIA_NETWORK`, `INVESTMENT_FIRM`, `PRIVATE_EQUITY_FIRM`,
  `VENTURE_CAPITAL_FIRM`, `FUND`, `BRAND`, `TRUST`, `NONPROFIT`, `UNKNOWN_ENTITY`
- **`relationship.type`**: `OWNS`, `PARTIALLY_OWNS`, `CONTROLS`, `OPERATES`,
  `MANAGES`, `FUNDS`, `INVESTED_IN`, `ACQUIRED`, `MERGED_WITH`, `LICENSES_FROM`,
  `REPRESENTS`, `FOUNDED_BY`, `HOSTED_BY`, `EMPLOYS`, `SUBSIDIARY_OF`,
  `PORTFOLIO_COMPANY_OF`, `CREATIVE_CONTROL_BY`, `DISTRIBUTED_BY`, `AD_SALES_BY`,
  `FORMERLY_OWNED_BY`
- **`control_level`**: `CONTROLLING`, `MINORITY`, `MANAGEMENT`, `LICENSE`,
  `UNKNOWN`
- **`status`**: `ACTIVE`, `ENDED`, `DISPUTED`, `PENDING_REVIEW`

## Modeling conventions

- **Ownership vs. representation vs. distribution.** A talent manager (`REPRESENTS`,
  `MANAGES`), an ad-sales rep (`AD_SALES_BY`), a distributor (`DISTRIBUTED_BY`), or
  a podcast/streaming deal is **not** ownership. Keep them out of the ownership
  chain; type them precisely.
- **Minority investment ≠ ownership.** A VC/PE minority stake is `INVESTED_IN` with
  `control_level: MINORITY`, not `OWNS`.
- **Creator-controlled companies.** If creators are the documented sole owners of
  the company that holds the channel but the split isn't public, model each as
  `PARTIALLY_OWNS` + `control_level: CONTROLLING` (no percentage). That is what
  makes the company creator-controlled.
- **Transitions.** To record owner A → B: on A's edge set `effective_to` +
  `status: ENDED`; on B's edge set `effective_from` (same date), no `effective_to`,
  `status: ACTIVE`. Only the current owner drives the label; prior owners become
  history.
- **Shared entities.** If two channels share a parent (e.g. two Moonbug shows),
  reuse the **same entity `slug` + fields verbatim** across records so the graph
  links them into one node.
- **Privacy.** Only publicly self-disclosed personal facts. No home addresses, no
  doxxing pseudonymous creators, nothing about minors beyond public brand facts.

## Copy-paste research prompt

> You are a CHANNELWATCH ownership researcher. For the YouTube channel
> **"&lt;NAME&gt;"** (handle **&lt;@HANDLE&gt;**), produce ONE research record as a YAML
> file at `data/research/&lt;slug&gt;.yaml`, following `data/research/_TEMPLATE.yaml`
> exactly and matching the style of `data/research/little-baby-bum.yaml`.
>
> GOAL: document who **owns / finances / operates** this channel, with sourced
> evidence. Ownership _structure_ only — never assert or imply editorial control,
> misconduct, or that a creator "sold out." Precision over recall: if evidence is
> thin, record less or leave it out. NEVER guess a channel ID or a date.
>
> COLLECT:
>
> 1. The canonical channel id (`UC` + 22 chars) from the channel page source
>    (`externalId` / canonical `/channel/UC…` URL). Verify it — it's the key.
> 2. The ownership CHAIN bottom-up: who owns the channel, who owns that, up to the
>    ultimate parent. Per entity: canonical name, `entity_type` (from the allowed
>    list), plus `legal_name`/`jurisdiction`/`website`/`aliases` if available.
> 3. For each ownership EDGE: `type` + `control_level` + `ownership_percentage`
>    (only if a source states it, else omit) + `effective_from` (the OPERATIVE
>    `YYYY-MM-DD` date; omit if only month/year is known) + `confidence` 0–1 +
>    `status` (`ACTIVE` = current, `ENDED` = a superseded prior owner with
>    `effective_to` set).
> 4. For EACH edge, ≥1 SOURCE: `url`, `title`, `publisher`, `published_at` (the
>    announcement date), `source_type` (allowed list), `tier` (MUST equal the
>    source_type's tier), an `archive_url` (Wayback) if the page may rot or is
>    paywalled/blocked, a verbatim `excerpt` ≤500 chars that establishes the edge,
>    and `supports:` linking it to the relationship index it backs. An ACTIVE edge
>    must have a Tier 1–3 source; Tier 4 is leads-only and cannot back an ACTIVE
>    edge.
>
> EVIDENCE STANDARD: prefer Tier 1 (regulatory filings, official acquisition
> announcements, investor portfolio pages, corporate registries, direct creator
> confirmation). Tier 2 = reputable business/industry press, named-exec
> interviews. A publicly visible **PE-Backed** label needs one Tier 1 source OR two
> independent Tier 2 sources. Distinguish OWNERSHIP from representation/management
> (`REPRESENTS`/`MANAGES`), distribution (`DISTRIBUTED_BY`/`AD_SALES_BY`), and
> minority investment (`INVESTED_IN` + `MINORITY`). If the honest answer is
> "independent / creator-owned / unknown," encode that (e.g. creator
> `PARTIALLY_OWNS` the channel/company with `control_level: CONTROLLING`, or leave
> ownership `UNKNOWN`).
>
> WRITE the file with the template's field names. Do NOT include a classification
> field — it's computed on import. Set `review.researched_by`, and
> `review.notes` with per-edge confidence reasoning, date-precision caveats,
> entity gaps, and open questions. Leave `review.reviewed_by` ABSENT (a human sets
> it after verification). Set `review.last_reviewed_at` to today's date.
>
> Output only the final YAML.

## Validate before you commit

Run the importer against any Postgres — it validates with the exact schema and
prints one line per channel; it's idempotent, and only records with `reviewed_by`
set actually publish:

```bash
export DATABASE_URL='postgres://channelwatch:channelwatch@localhost:5432/channelwatch'
npx pnpm@9 db:migrate
npx pnpm@9 import:research
```

A validation error names the exact field and rule (e.g. "source X declares tier 1
but source_type Y is Tier 2", or "relationship 3 has no supporting source"). Fix
and re-run.
