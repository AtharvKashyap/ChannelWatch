# Launch legal self-audit — user-facing strings vs. §23.1

A pre-launch sweep of every user-facing string against the SPEC §23.1 /
`docs/legal-risk.md` §1 banned-vs-safe language table. This is an **engineering
self-audit, not legal advice** — it exists to feed the attorney review in
`docs/launch-checklist.md` item 1, not to replace it.

## The §23.1 test applied to each string

**Banned (from §23.1):**

- "…sold out to private equity" / any "sold out" framing.
- "The creator no longer has any control" / "no longer has control" /
  "lost control".
- Any wording implying **misconduct, editorial interference, or guilt**.
- Asserting a stake is controlling, or a creator lost control, when not
  publicly documented.

**Preferred (from §23.1):** neutral, structural, fact-first phrasing —
"Public records indicate that Company A acquired Channel B"; "The exact
ownership percentage was not publicly disclosed"; "The creator remains publicly
associated with the channel, but current ownership terms are not publicly
available."

**Verdict key:** PASS = compliant; VIOLATION = must fix.

---

## 1. Reviewed copy module (`packages/schemas/src/copy.ts`)

This is the single source of truth for ownership language (`CLAUDE.md` rule 2).
Every export below feeds the extension badge/panel, the public site, and the API
lookup response.

| String / export                                                   | Sample output                                                                                                                                                                                                                 | Verdict                                                                                                                                                                                    |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BADGE_LABELS` (all 9 labels)                                     | "Independent", "Creator-Owned", "Externally Funded", "Corporate-Owned", "Nonprofit-Owned", "PE-Backed", "Ownership Changed", "Ownership Unclear", "Disputed"                                                                  | PASS — structural labels; match SPEC §9.1; no misconduct implication                                                                                                                       |
| `EDITORIAL_DISCLAIMER`                                            | "No conclusion is made about editorial interference."                                                                                                                                                                         | PASS — this is the §23.2 standing disclaimer                                                                                                                                               |
| `CORRECTION_CTA`, `CORRECTION_RECEIVED`, `RESEARCH_LEAD_RECEIVED` | "Report an Error"; "Correction received and queued for review."                                                                                                                                                               | PASS                                                                                                                                                                                       |
| `ownedBy()`                                                       | "Public records indicate that {owner} owns {channel}."                                                                                                                                                                        | PASS — the §23.1 preferred fact-first form verbatim                                                                                                                                        |
| `portfolioCompanyOf()`                                            | "{owner} is a portfolio company of {sponsor}."                                                                                                                                                                                | PASS — structural, no control claim                                                                                                                                                        |
| `undisclosedStake()`                                              | "{creator} retains a stake, but the exact ownership percentage was not publicly disclosed."                                                                                                                                   | PASS — §23.1 preferred wording verbatim                                                                                                                                                    |
| `badgeText()` / `badgeAriaLabel()`                                | "PE-Backed · Blackstone"                                                                                                                                                                                                      | PASS — label + entity name only                                                                                                                                                            |
| `ownershipMechanismText()`                                        | "acquired", "subsidiary of", "portfolio company of", "controlling stake", "ownership stake", "majority investment", "minority investment"                                                                                     | PASS — structural mechanism terms only; controlling/majority language is gated on the recorded `controlLevel`, never asserted by default                                                   |
| `ownershipStakeText()`                                            | "{n}% stake" or "stake not publicly disclosed"                                                                                                                                                                                | PASS — honest undisclosed fallback, no controlling assertion                                                                                                                               |
| `UNRESEARCHED_SUMMARY`                                            | "This channel has not yet been researched."                                                                                                                                                                                   | PASS                                                                                                                                                                                       |
| `classificationSummary()` (all branches)                          | "Public records indicate that {owner} owns {channel}. {owner} is a subsidiary of {parent}."; "Public records do not indicate external ownership of {channel}."; "Public sources do not clearly establish who owns {channel}." | PASS — every branch is fact-first, admits uncertainty, and never asserts control loss or misconduct                                                                                        |
| `CONFIDENCE_LABEL_TEXT`                                           | "Confirmed", "High confidence", …, "Disputed", "Unknown"                                                                                                                                                                      | PASS                                                                                                                                                                                       |
| `EXPLANATION_TEXT` (all codes)                                    | "The direct owner is confirmed by public sources."; "The owner is a private-equity portfolio company."; "No public ownership evidence was found."                                                                             | PASS — structural, auditable; "disputed" describes a data state, not wrongdoing                                                                                                            |
| `CREATOR_STATUS_TEXT` (all states)                                | "Creator owns and operates the channel"; "Creator hosts the channel without an ownership stake"; "Creator is no longer involved"                                                                                              | PASS — describes structural role; "no longer involved" states involvement status, **not** "lost control" or "sold out"                                                                     |
| `PANEL_COPY`                                                      | section/form labels ("Direct owner", "Report an Error", …)                                                                                                                                                                    | PASS — chrome/labels, no ownership assertions                                                                                                                                              |
| `POPUP_COPY`                                                      | title + "Ownership badges appear next to channel names… Click a badge to see who owns the channel and the sources behind it."                                                                                                 | PASS — also used as the web `<title>`/`description` metadata                                                                                                                               |
| `CHAIN_COPY`                                                      | "Ownership chain", "Ownership over time", "previously", "current", "date not publicly disclosed"                                                                                                                              | PASS — temporal/structural; honest undated fallback                                                                                                                                        |
| `SITE_COPY`                                                       | homeHeading "Who owns the channels you watch?"; homeBlurb "Acquisition is not guilt; investment is not proof of editorial control. When the evidence is thin, the honest answer is that ownership is unknown."                | PASS — mirrors the MANIFESTO; explicitly disclaims guilt/control                                                                                                                           |
| `CORRECTION_PAGE_COPY`                                            | "Report an error"; "Corrections are logged, reviewed, and — where a record changes — kept visible rather than silently rewritten."                                                                                            | PASS — matches §23.3                                                                                                                                                                       |
| `METHODOLOGY_COPY`                                                | evidence tiers, confidence levels, PE-rule ("an orange badge describing ownership structure — never a red badge, and never an implication of misconduct"), two-person review                                                  | PASS — descriptive of method; asserts nothing about any channel; "fraud/misrepresentation/political influence" appear only as **categories that trigger extra review**, not as accusations |
| `REVIEW_CONSOLE_COPY`                                             | "Second review required"; "This claim is flagged for two-person review…"                                                                                                                                                      | PASS — internal reviewer chrome; a process flag, explicitly "never an accusation"                                                                                                          |
| `evidenceCountText()`, `lastReviewedText()`                       | "3 sources reviewed"; "Last reviewed {date}"                                                                                                                                                                                  | PASS                                                                                                                                                                                       |

**Copy-module verdict: 0 violations.** All ownership language is fact-first,
separates ownership/control/influence, admits uncertainty, and never implies
misconduct or loss of control.

---

## 2. Extension manifest (`apps/extension/manifest.config.ts`)

| Field                  | Value                                                                                            | Verdict                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `name`                 | "CHANNELWATCH"                                                                                   | PASS                                                                                                                       |
| `description`          | "Shows who owns, finances, or commercially influences a YouTube channel, with sourced evidence." | PASS — neutral; "commercially influences" is structural and paired with "with sourced evidence"; no misconduct implication |
| `action.default_title` | "CHANNELWATCH"                                                                                   | PASS                                                                                                                       |

Verified in the **built** manifest too (`dist/manifest.json`) — the baked
description matches the source string exactly.

---

## 3. Web pages — metadata / titles (`apps/web`)

| Location                                        | Value                                                                                                        | Verdict                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `src/app/layout.tsx` `metadata.title`           | `POPUP_COPY.title` ("CHANNELWATCH")                                                                          | PASS — sourced from the reviewed module |
| `src/app/layout.tsx` `metadata.description`     | `POPUP_COPY.description`                                                                                     | PASS — sourced from the reviewed module |
| `src/app/methodology/page.tsx` `metadata.title` | `` `${METHODOLOGY_COPY.heading} · CHANNELWATCH` ``                                                           | PASS — sourced from the reviewed module |
| `src/app/channel/[youtubeChannelId]/page.tsx`   | no custom `generateMetadata`; inherits root layout; evidence `title` values come from stored sourced records | PASS — no page-authored ownership prose |

No web page inlines its own ownership prose; all visible ownership text is
rendered from the copy module and the reviewed data records.

---

## 4. Extension popup / options components

| Location                  | Strings                                                                                                                                                                                                                                                                            | Verdict                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/popup/Popup.tsx`     | renders `POPUP_COPY.*` + `EDITORIAL_DISCLAIMER` only                                                                                                                                                                                                                               | PASS — all from the reviewed module                                                                                                                                                                                                                                                                                                                                                                              |
| `src/options/Options.tsx` | inline settings-chrome strings: "CHANNELWATCH Settings", "Badge scope:", "Everywhere", "Watch + channel pages only", "Hide badges for creator-owned channels", "Only show confirmed-confidence records", "API base URL (dev):", the origin-validation message, "Loading settings…" | PASS (legal) — these are **settings UI chrome**, not ownership claims; none touch the §23.1 subject matter. **Observation (not a violation):** they are inline rather than in the copy module; `CLAUDE.md` rule 2 governs _ownership language_ specifically, which these are not, so no fix is required for launch. Optional future tidy: move them to a `copy.ts` settings block for single-source consistency. |

---

## Result

**Strings checked: all user-facing copy across the copy module, the extension
manifest, the web metadata/titles, and the extension popup/options components.**

**Violations found: 0. Fixes applied to code: none required.**

The banned-phrase sweep (`sold out`, `no longer has control`, `lost control`,
`secretly`, `misconduct`, `guilt`, `shill`, `puppet`, `corrupt`, etc.) matched
only (a) explanatory comments in `copy.ts` describing what to avoid, and (b)
safe, disclaiming contexts ("Acquisition is not guilt", "never an implication of
misconduct", "controlled by its creator"). No user-facing output string
contains banned phrasing.

This clean result does **not** discharge `docs/launch-checklist.md` item 1.1 —
a licensed attorney must still review the defamation posture. This audit gives
that review a complete inventory of the language actually shipped.
