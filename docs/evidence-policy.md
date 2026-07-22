# CHANNELWATCH Evidence Policy

This document defines what counts as evidence, how evidence and claims move through
their lifecycles, the "leads only" rule for the weakest tier, and the categories of
information CHANNELWATCH will never publish. It is adapted from the founding spec;
citations point to the source of each rule.

See `METHODOLOGY.md` for the evidence tiers themselves, the scoring model, and the
review workflow. This document governs the handling and status of evidence.

---

## 1. What Counts as Evidence

Every published classification must be supported by inspectable evidence
(Spec §3.2). No hidden model may make an unreviewable accusation. Evidence is a
concrete, retrievable source — a document, filing, page, or on-the-record
statement — attached to a discrete claim.

Evidence is assigned to one of four tiers by authority and directness (Spec §7.1,
detailed in `METHODOLOGY.md`):

- **Tier 1 — Primary authoritative sources** (filings, registries, official
  acquisition announcements, portfolio pages, court records, official statements).
- **Tier 2 — Reputable secondary sources** (established business and trade
  publications, named-executive interviews, investigative journalism, sourced
  financial databases).
- **Tier 3 — Supporting technical evidence** (domain and website ownership
  history, shared legal/contact/address information, app-store publisher changes,
  archived ToS). Interpret cautiously — shared infrastructure may reflect common
  service providers rather than common ownership (Spec §13.5).
- **Tier 4 — Leads only** (see §4 below).

For each source, CHANNELWATCH stores the URL, retrieval timestamp, page title,
publisher, author, publication date, content hash, a short relevant excerpt, an
archive URL, HTTP status, language, source type, and tier (Spec §16 `sources`,
§26.4). Entire copyrighted articles are not mirrored unless legally permitted
(Spec §19.4).

Community submissions must include a claim, a URL or document, a short
explanation, the claimed relationship type, optional identity disclosure to
moderators, and a good-faith declaration (Spec §11.5). Anonymous submissions may
be accepted as research leads but carry less evidentiary weight.

---

## 2. Source Status Lifecycle (Spec §8.2)

Every evidence item carries exactly one status:

```text
ACTIVE
SUPERSEDED
RETRACTED
DISPUTED
ARCHIVED
BROKEN_LINK
PENDING_REVIEW
```

- **PENDING_REVIEW** — newly ingested; not yet weighable in a published claim.
- **ACTIVE** — verified and currently supporting one or more claims.
- **SUPERSEDED** — replaced by a newer, more authoritative source for the same
  fact; retained for the audit trail.
- **DISPUTED** — a credible party contests the source's accuracy or relevance.
- **RETRACTED** — withdrawn by its publisher, or found fabricated/unreliable.
- **ARCHIVED** — no longer primary but preserved for provenance.
- **BROKEN_LINK** — the original URL no longer resolves; the archived copy and
  content hash preserve what was cited.

Continuous monitoring may detect a changed or removed source; this creates a
review task and updates the source status — it does not silently alter published
records (Spec §12.9, §19.4).

---

## 3. Claim Status Lifecycle (Spec §8.3)

Every claim carries exactly one status:

```text
DRAFT
UNDER_REVIEW
PUBLISHED
DISPUTED
CORRECTED
RETRACTED
ARCHIVED
```

- **DRAFT** — created from evidence (or LLM-extracted), not yet reviewed.
- **UNDER_REVIEW** — in the reviewer queue against the checklist (Spec §20.2).
- **PUBLISHED** — approved and visible via extension, website, API, and export.
- **DISPUTED** — a credible party contests a published claim; a public dispute
  notice may be shown (Spec §24.4) and the record placed under review.
- **CORRECTED** — updated after review; the change and its reason remain visible
  in the audit trail (Spec §23.3).
- **RETRACTED** — withdrawn as unsupported or incorrect; the retraction is
  recorded and visible.
- **ARCHIVED** — superseded by a later claim (e.g. a subsequent resale) but kept
  for history.

Claims are the review-workflow artifact; the published, classifier-visible
artifact is the set of active relationships derived from published claims. See
`data-model.md`.

---

## 4. Tier 4 — "Leads Only" Rule (Spec §7.1)

Tier 4 evidence — social-media speculation, Reddit posts, anonymous tips, sudden
stylistic changes, similar thumbnails, shared sponsors, upload-pattern changes,
unverified leaked screenshots — **may initiate research but must never
independently support a published ownership claim.**

Consequences of this rule:

- A claim whose only support is Tier 4 evidence cannot be published; it remains a
  research lead (confidence band 0.00–0.29, "Research Lead Only", Spec §14.3).
- Behavioral and operational change signals may justify investigation but never
  ownership classification on their own (Spec §13.4).
- Anonymous tips carry a weight of 0.10 and behavioral content changes 0.05 in the
  evidence-weight table (Spec §14.1) — deliberately far below any publication
  threshold on their own.
- LLMs must not infer ownership from style, writing patterns, or thumbnails
  (Spec §21.2).

Precision is more important than coverage: a missed acquisition is preferable to a
false accusation (Spec §28.5, §40.11).

---

## 5. Creator-Safety Exclusions (Spec §22.4)

Regardless of tier or confidence, CHANNELWATCH does **not** publish:

- Home addresses.
- Personal phone numbers.
- Family information.
- Private email addresses.
- Confidential contracts.
- Leaked personal documents.
- Speculative personal wealth.
- Information unrelated to ownership transparency.

The project scrapes or republishes no confidential documents and exists to provide
ownership transparency, not to enable harassment of creators or employees
(Spec §5.2). Confidential or leaked personal documents are excluded even when they
would otherwise strengthen a claim.
