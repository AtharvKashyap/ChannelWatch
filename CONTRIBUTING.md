# Contributing to CHANNELWATCH

Thank you for helping build a transparent, evidence-first record of YouTube channel
ownership. Before contributing, please read `README.md`, `docs/METHODOLOGY.md`,
and `docs/legal-risk.md` — they set the project's principles and evidence
standards, and they bind every contribution.

Contributions fall into two very different categories, adapted from Spec §31:
**code** and **research**. They follow different rules.

---

## Code Contributions

Code, documentation, translation, accessibility improvements, selector fixes,
security testing, and tooling are reviewed like ordinary open-source work: fork,
branch, open a pull request, keep it focused, and make sure CI is green.

### Dev workflow (pnpm + Turborepo)

TypeScript-only monorepo. Common commands:

```
pnpm install          # install workspace dependencies
pnpm dev              # turbo dev across workspaces
pnpm test             # vitest everywhere
pnpm lint             # eslint + prettier check
pnpm db:migrate       # drizzle migrations
pnpm db:seed          # seed reference data
pnpm import:research   # validate + import data/research/*.yaml
docker compose up     # postgres + api + web for local dev
```

Conventions (see `CLAUDE.md` for the full list):

- Zod schemas and enums in `packages/schemas` are the single source of truth;
  never introduce a parallel or ad-hoc shape.
- Pure logic in `packages/graph` and `packages/scoring` is developed test-first.
- All user-facing ownership language comes from the reviewed copy module
  (`packages/schemas/src/copy.ts`) — never ad-hoc strings. Badge labels are enum
  values, never free text. Red badge = data-quality/disclosure dispute; PE-backed
  is orange (Spec §9.2).
- All YouTube DOM selectors live in `apps/extension/src/content/selectors.ts`; the
  extension must fail silently and never break the page.

---

## Research Contributions

**Research contributions are not merged like ordinary code** (Spec §31). A source,
a claim, an entity alias, or a correction changes what the public sees about a real
person or company, so it goes through the research review workflow, not a plain
code review.

Every research contribution requires:

- **Source verification** — a real, retrievable source at Tier 1–3; Tier 4
  material is a research lead only and can never independently support a published
  claim (`docs/evidence-policy.md` §4).
- **Entity verification** — the named entity resolves to the correct canonical
  record (entity resolution, Spec §12.4).
- **Reviewer approval** — a reviewer works the checklist in `docs/METHODOLOGY.md`
  §4; sensitive claims (hidden ownership, fraud, named individuals, political
  influence, etc.) require **two-person review** before publication
  (Spec §20.3).
- **Neutral wording** — use the prefer/avoid language in `docs/legal-risk.md` §1;
  describe structure, never imply misconduct.
- **Audit logging** — every material change writes an `audit_events` record
  (who/what/when/why/evidence, Spec §26.5). Published records are never silently
  rewritten.

During the seed phase, research records are authored as YAML files in
`data/research/` (one per channel: claims + sources + excerpts), validated by Zod,
and reviewed as pull requests before import (`plan.md` modification #6). This gives
diffable, PR-reviewable provenance.

Note on scope and conflicts: CHANNELWATCH records ownership only — no ideological
scoring (Spec §32.3). A reviewer must not approve claims involving their employer,
investments, clients, a funder of the project, a creator with whom they have a
personal dispute, or a company they are investigating elsewhere (Spec §30.2).

---

## Commit Messages

Use plain, descriptive commit messages. **Do not** add `Co-Authored-By` trailers
or any "generated with" trailers.

---

## Reporting Problems

- **Security vulnerabilities:** follow `SECURITY.md` (private report — never a
  public issue).
- **Incorrect ownership records:** use the correction/appeal process
  (`docs/legal-risk.md` §3), not a code PR.
