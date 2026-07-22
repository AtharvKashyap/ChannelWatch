# CHANNELWATCH Legal and Defamation Risk Policy

This project has meaningful legal exposure. A false claim that a person or company
secretly controls a channel could cause reputational or commercial harm
(Spec §23). This document is binding policy, adapted from Spec §23 in full. It
governs the language of every published record, how facts are separated from
interpretation, how corrections are handled, and what legal review must precede a
public launch.

---

## 1. Safer Language (Spec §23.1)

Published records must use the "prefer" wording and avoid the "avoid" wording
below. These pairs are reproduced verbatim from the spec and are enforced in code
through the reviewed copy module (`packages/schemas/src/copy.ts`), not left to
ad-hoc phrasing.

**Prefer:**

> "Public records indicate that Company A acquired Channel B."

**Avoid:**

> "Channel B sold out to private equity."

---

**Prefer:**

> "The exact ownership percentage was not publicly disclosed."

**Avoid:**

> "The creator no longer has any control."

---

**Prefer:**

> "The creator remains publicly associated with the channel, but current ownership
> terms are not publicly available."

---

General principle: describe ownership structure; never imply misconduct, editorial
interference, or guilt. Acquisition is not guilt; investment is not proof of
editorial control (Spec §4, §40.1–40.2). Badges describe structure, not
wrongdoing (Spec §9.1).

---

## 2. Separate Facts from Interpretation (Spec §23.2)

A published record must visibly separate what is verified, what is unknown, and
any interpretation. The display format is:

```text
Verified Fact:
Company A announced an investment in Company B.

Unknown:
Whether Company A has editorial control.

Interpretation:
No conclusion is made about editorial influence.
```

The standing disclaimer "No conclusion is made about editorial interference"
appears on every evidence panel (Spec §36; plan modification #7). Financial
ownership, operational control, and creative influence are distinct and are
described separately (Spec §4, §40.2).

---

## 3. Correction Policy (Spec §23.3)

Corrections must:

- Be processed promptly.
- Preserve an audit trail.
- Identify what changed.
- Explain why it changed.
- Notify the submitter.
- Update cached extension results.
- Avoid silently rewriting controversial records.

Every correction writes an `audit_events` record (who/what/when/why/evidence,
Spec §26.5) and updates the extension cache so a corrected record does not persist
in clients (extension cache TTLs, Spec §18.6). Controversial records are never
silently rewritten; the prior state and the reason for change remain visible. When
credible disagreement exists, a public dispute notice may be shown while the record
is under review (Spec §24.4). Anyone — channel owners, creators, company
representatives, investors, employees, researchers, or members of the public — may
submit a correction or appeal (Spec §24.1).

---

## 4. Pre-Launch Legal Review Checklist (Spec §23.4)

Before large-scale public launch, obtain legal review covering:

- Defamation.
- Copyright.
- Database rights.
- Terms of service.
- Web scraping.
- Fair use.
- Data protection.
- Right of reply.
- Record retention.
- Safe-harbor procedures.

This review is MVP-blocking for public launch and appears in the M3 launch-prep
milestone (`plan.md`; roadmap in `roadmap.md`).
