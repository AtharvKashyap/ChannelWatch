# CHANNELWATCH Research Methodology

This document is the research constitution. It defines how CHANNELWATCH gathers
evidence, weighs it, expresses confidence and uncertainty, reviews claims, and
decides what may be published. It is adapted from the founding spec — the section
citations (e.g. "Spec §14.3") point to the source of each rule.

The guiding rule (Spec §7): detection uses an **evidence-first classification
process**. It is never based on a single unexplained score. The platform collects
discrete, sourced claims; the published ownership status is assembled from claims
that have passed human review. No sensitive classification is published without
review during the early stages of the project (Spec §12.7).

---

## 1. Evidence Hierarchy (Spec §7.1)

Every source is assigned to one of four tiers. Tier determines how much weight a
source may carry and whether it can support a published claim at all.

### Tier 1 — Primary Authoritative Sources

- Securities filings.
- Corporate registries.
- Official acquisition announcements.
- Investor portfolio pages.
- Official company ownership disclosures.
- Court records.
- Bankruptcy filings.
- Government competition filings.
- Official statements by the creator.
- Official statements by the acquiring company.

### Tier 2 — Reputable Secondary Sources

- Established business publications.
- Trade publications.
- Interviews with named executives.
- Investigative journalism.
- Financial databases with clear sourcing.
- Industry newsletters with accountable authorship.

### Tier 3 — Supporting Technical Evidence

- Historical website ownership pages.
- Domain registration changes.
- Shared legal contact information.
- Shared advertising disclosures.
- Shared corporate addresses.
- Public employment records.
- App-store publisher changes.
- Archived terms-of-service pages.
- Channel business contact changes.

### Tier 4 — Leads Only

- Social-media speculation.
- Reddit posts.
- Anonymous tips.
- Sudden stylistic changes.
- Similar thumbnails.
- Shared sponsors.
- Upload-pattern changes.
- Unverified leaked screenshots.

**Tier 4 evidence may initiate research but must not independently support a
published ownership claim** (Spec §7.1). See `evidence-policy.md` for the full
"leads only" rule.

---

## 2. Confidence Levels and Statuses (Spec §8)

Each claim receives both an evidence classification and a confidence level.

### 2.1 Confidence Levels (Spec §8.1)

- **Confirmed** — the relationship is established through strong primary evidence
  (e.g. corporate filing, official acquisition announcement, owner portfolio
  listing, direct creator confirmation).
- **High Confidence** — multiple credible sources agree and no material
  contradiction exists.
- **Moderate Confidence** — credible evidence exists but the exact ownership or
  control terms remain incomplete.
- **Low Confidence** — evidence is suggestive but insufficient for a public
  ownership label. Low-confidence claims should generally not produce a prominent
  warning.
- **Disputed** — credible parties provide conflicting accounts.
- **Unknown** — insufficient evidence exists.

Uncertainty is first-class. "Unknown" is a valid, common, and honest outcome; it
must never be presented as suspicion (Spec §3.3, §40.3).

### 2.2 Evidence Status (Spec §8.2)

Each evidence item is labeled with exactly one status:

```text
ACTIVE
SUPERSEDED
RETRACTED
DISPUTED
ARCHIVED
BROKEN_LINK
PENDING_REVIEW
```

### 2.3 Claim Status (Spec §8.3)

Each claim moves through the following statuses:

```text
DRAFT
UNDER_REVIEW
PUBLISHED
DISPUTED
CORRECTED
RETRACTED
ARCHIVED
```

The full source-status and claim-status lifecycles are documented in
`evidence-policy.md`.

---

## 3. Scoring Model (Spec §14)

The scoring model estimates confidence in a **specific claim** — not whether a
company is "good" or "bad" (Spec §14). The project must not optimize for the
number of channels labeled PE-backed; that would create pressure to over-classify
(Spec §33.3).

### 3.1 Evidence Weights (Spec §14.1)

```text
Official regulatory filing                   1.00
Official acquisition announcement            0.95
Official investor portfolio listing          0.90
Direct creator confirmation                  0.90
Corporate registry record                    0.90
Reputable business publication               0.80
Established industry publication             0.75
Named executive interview                    0.75
Archived corporate page                      0.65
Trademark transfer                           0.65
Shared legal documentation                   0.60
Technical infrastructure linkage             0.35
Anonymous tip                                0.10
Behavioral content change                    0.05
```

Weights are **not** simply added. The model must account for source independence,
corroboration, recency, directness, contradiction, entity-match quality, and
whether the source states ownership or merely association (Spec §14.1).

### 3.2 Claim Confidence Formula (Spec §14.2)

```text
claim_confidence =
    source_quality
    × directness
    × entity_match
    × recency_factor
    × corroboration_factor
    × contradiction_penalty
```

Worked example (Spec §14.2):

```text
source_quality         = 0.95
directness             = 1.00
entity_match           = 0.98
recency_factor         = 0.95
corroboration_factor   = 1.00
contradiction_penalty  = 1.00

confidence = 0.884
```

### 3.3 Publication Thresholds (Spec §14.3)

```text
0.90–1.00  Confirmed
0.75–0.89  High Confidence
0.55–0.74  Moderate Confidence
0.30–0.54  Low Confidence
0.00–0.29  Research Lead Only
```

### 3.4 PE-Backed Label Rule (Spec §14.3)

For a publicly visible **PE-backed** label, require:

- **At least one Tier 1 source, or**
- **Two independent Tier 2 sources plus strong entity resolution.**

A channel may be marked PE-backed only when: the channel is owned by a company;
that company is controlled or materially backed by another entity; the controlling
or backing entity is a private equity firm or PE-sponsored portfolio company; and
the relationship is supported by evidence (Spec §13.2). PE-backed is an **orange**
badge describing structure — never a red badge and never an implication of
misconduct (Spec §9.2).

---

## 4. Review Checklist (Spec §20.2)

Before publishing an ownership claim, a reviewer must:

- Confirm the exact channel ID.
- Confirm the company or entity identity.
- Confirm the relationship type.
- Confirm the effective date.
- Confirm whether the transaction closed.
- Confirm whether the relationship is still current.
- Confirm whether private equity involvement is direct or indirect.
- Confirm whether control is known.
- Search for contradictory evidence.
- Check whether the creator publicly disputed the claim.
- Use neutral wording.
- Attach at least one strong source.
- Record reviewer reasoning.

---

## 5. Two-Person Review (Spec §20.3)

Two reviewers must approve before publication for high-risk claims involving:

- Hidden ownership.
- Undisclosed acquisition.
- Fraud.
- Misrepresentation.
- Editorial interference.
- Political influence.
- Named individuals.

---

## 6. LLM Usage Rules (Spec §21)

LLMs may assist research but **must not act as autonomous publishers** (Spec §21).
LLMs draft; humans publish. Model confidence is never treated as factual
confidence.

### 6.1 Appropriate Uses (Spec §21.1)

LLMs may:

- Summarize acquisition announcements.
- Extract company names.
- Extract transaction dates.
- Identify ownership language.
- Suggest potential entity matches.
- Classify source type.
- Generate neutral summaries from approved facts.
- Detect contradictions between documents.
- Translate foreign-language corporate disclosures.

### 6.2 Prohibited Uses (Spec §21.2)

LLMs must not:

- Decide that a channel was acquired based on style changes.
- Publish claims without source review.
- Infer secret ownership from writing patterns.
- Determine creator intent.
- Accuse companies of manipulation.
- Label organizations as private equity without verified evidence.
- Generate fake citations.
- Treat model confidence as factual confidence.

All LLM output is validated deterministically against a known schema, the source
text, the entity registry, date formats, the relationship vocabulary, a URL
allowlist, and quotation verification before a human reviews it (Spec §21.4).

---

## Related documents

- `evidence-policy.md` — what counts as evidence, source and claim lifecycles,
  Tier 4 rule, creator-safety exclusions.
- `legal-risk.md` — safer-language rules, fact-vs-interpretation display,
  correction policy, pre-launch legal review.
- `data-model.md` — how claims, relationships, and computed classifications relate.
