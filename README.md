# CHANNELWATCH

### Know who's _really_ behind the channel. 🔍

It's an open, evidence-first map of who **owns, finances, and operates** YouTube channels: a browser extension that surfaces the answer in a click, a public research site, and a human-reviewed data platform behind both.

---

## What it does

- 🧩 **Extension** — click the toolbar icon on any YouTube video; a popup shows the channel's ownership label, the full chain (creator → studio → parent → ultimate owner), _when_ it changed hands and _by whom_, and the sources behind every claim. No badges injected into the page, no tracking — it only ever asks the API "who owns this channel ID?"
- 🌐 **Public site** — searchable channel pages with the ownership chain, an "Ownership over time" history, the evidence, a methodology page, and a "Report an error" form.
- 🛠️ **Review console** — an authenticated workflow where researchers approve/reject claims with reasoning, manage entities, work a corrections inbox, and read the audit trail. Sensitive claims require **two** reviewers.
- 🧠 **A classification engine** that never guesses: labels are _computed_ from reviewed relationships, not typed in by hand.

### The labels

| Badge               | Meaning                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| 🟢 `CREATOR_OWNED`  | The creator (or their wholly-controlled company) owns the channel                |
| `EXTERNALLY_FUNDED` | Creator-controlled, but with a documented outside investor                       |
| `CORPORATE_OWNED`   | Owned by a for-profit company / media group                                      |
| `NONPROFIT_OWNED`   | Held by a nonprofit organization                                                 |
| 🟠 `PE_BACKED`      | A private-equity firm sits in the ownership chain                                |
| `OWNERSHIP_CHANGED` | Recently changed hands                                                           |
| `OWNERSHIP_UNCLEAR` | Public evidence doesn't establish ownership                                      |
| 🔴 `DISPUTED`       | A data-quality/disclosure dispute is open (red is **only** ever this — never PE) |

---

## See it in 60 seconds

```bash
git clone https://github.com/AtharvKashyap/ChannelWatch.git
cd ChannelWatch

npx pnpm@9 install                 # Node ≥ 20, pnpm 9 (npx pnpm@9 works with no global install)
docker compose up -d postgres      # local database
export DATABASE_URL='postgres://channelwatch:channelwatch@localhost:5432/channelwatch'
npx pnpm@9 db:migrate              # create the schema
npx pnpm@9 import:research          # load the researched channels
npx pnpm@9 --filter @channelwatch/api dev   # API → http://localhost:8787
```

Then load the extension: build it with `npx pnpm@9 --filter @channelwatch/extension build`, open `chrome://extensions`, enable **Developer mode**, **Load unpacked** → `apps/extension/dist`. Open a video from a researched channel and click the CHANNELWATCH icon.

Want the public site too? `npx pnpm@9 --filter @channelwatch/web dev` → http://localhost:3000.

---

## How a claim becomes a badge

```
   research (YAML)          import + validate         graph engine            surfaces
 ┌──────────────────┐     ┌──────────────────-┐     ┌────────────────┐     ┌──────────────┐
 │ data/research/   │ ──► │ schema + evidence │ ──► │ compute owner  │ ──► │ extension    │
 │ <channel>.yaml   │     │ rules enforced;   │     │ chain + label  │     │ site         │
 │ (sources, edges) │     │ human review gate │     │ (never stored  │     │ /review      │
 └──────────────────┘     └──────────────────┘      │  as raw truth) │     └──────────────┘
                                                    └────────────────┘
```

Every published claim traces to inspectable sources. **LLMs draft, humans publish** — there is no code path that publishes a claim without human review. Classification is derived from the graph, never asserted by hand. Every database mutation writes an `audit_events` row.

---

## The stack

TypeScript everywhere, one monorepo (pnpm workspaces + Turborepo):

| Package            | What it is                                                                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/extension`   | Manifest V3 extension (React + Vite). **Popup-only, zero DOM injection, stores no user data** — a minimal content script just resolves the current video's channel ID. |
| `apps/web`         | Next.js public site + authenticated `/review` console.                                                                                                                 |
| `services/api`     | Hono + Drizzle + PostgreSQL. Public read API (`/api/v1`), corrections, authed reviewer endpoints, session auth, rate limiting, audit + request logging.                |
| `packages/schemas` | Zod schemas, enums, and the reviewed UI-copy module — the **single source of truth** shared by API, web, extension, and importer.                                      |
| `packages/graph`   | Ownership traversal, ultimate-parent resolution, classification derivation, temporal ownership-history. Pure, heavily tested.                                          |
| `packages/scoring` | Confidence formula, publication thresholds, explanation codes. Pure, heavily tested.                                                                                   |
| `data/research/`   | One YAML file per channel — the trust-critical publication boundary.                                                                                                   |

**Common commands** (`npx pnpm@9 <script>`): `dev`, `test`, `lint`, `format:check`, `db:migrate`, `db:seed`, `import:research`.

---

## Contribute a channel 🧑‍🔬

The dataset grows one well-sourced channel at a time, and that's the most valuable contribution you can make. Start here:

- 📓 [`docs/research-authoring-prompt.md`](./docs/research-authoring-prompt.md) — exactly what to gather, the evidence standards (tiers, dates, sourcing), the output format, and a copy-paste research prompt.
- 📁 [`data/research/README.md`](./data/research/README.md) — the authoring + review workflow.
- 📋 [`docs/covered-channels.md`](./docs/covered-channels.md) — the **244 channels covered so far**; [`data/research/_TARGETS.md`](./data/research/_TARGETS.md) is the backlog (goal: **1,000+**).

TL;DR: copy [`data/research/_TEMPLATE.yaml`](./data/research/_TEMPLATE.yaml) → `data/research/<channel>.yaml`, fill it with sourced ownership edges, run `npx pnpm@9 import:research` to validate, open a PR. The importer computes the label; a human reviewer publishes it.

---

## Project docs

| Doc                                                                        |                                        |
| -------------------------------------------------------------------------- | -------------------------------------- |
| [`docs/research-authoring-prompt.md`](./docs/research-authoring-prompt.md) | How to research & contribute a channel |
| [`data/research/README.md`](./data/research/README.md)                     | Research authoring + review workflow   |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md)                                     | How to help                            |
| [`PRIVACY.md`](./PRIVACY.md) · [`SECURITY.md`](./SECURITY.md)              | Privacy & security posture             |

---

## Status

Core platform complete and tested end-to-end: extension, public site, review console, classification engine, and a **57-channel** researched dataset (growing toward 100+). Remaining before a public launch is human/ops work, not code — finishing review of the newest draft records (with two-person sign-off on sensitive ones), a licensed-attorney pass, registering a DMCA agent, and the free-tier deploy.

## License & disclaimer

CHANNELWATCH publishes structural ownership information from public sources and makes **no claim about editorial interference or wrongdoing** by any channel, creator, or company. To dispute a record, use the correction form on the public site. See [`LICENSE`](./LICENSE) if present, otherwise all rights reserved by the project maintainers pending a license decision.
