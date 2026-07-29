# CHANNELWATCH Security Policy

This document summarizes the project's threat model (Spec §32) and explains how to
report a vulnerability. Security is central to CHANNELWATCH: the project handles
reputation-sensitive claims and ships a browser extension, so both data integrity
and client safety matter.

---

## Reporting a Vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately through either channel:

- **Email:** `security@channelwatch.example` _(placeholder — update before public
  launch)_.
- **GitHub private security advisories:** use the repository's _Security → Report a
  vulnerability_ form to open a private advisory.

Include what you found, how to reproduce it, and the potential impact. We will
acknowledge the report, investigate, and coordinate disclosure. Please give us
reasonable time to remediate before any public disclosure.

Reports about **incorrect ownership records** are not security issues — use the
correction/appeal process instead (the correction form on the public site).

---

## Threat Model Summary (Spec §32)

### False Submissions (§32.1)

Attackers may submit fabricated evidence against creators.
**Controls:** source validation, reviewer approval, submission rate limits,
contributor reputation, duplicate detection, two-person review.

### Corporate Manipulation (§32.2)

Owners may try to remove accurate records or submit misleading ownership
structures.
**Controls:** evidence-based appeals, a public correction trail, multiple
independent sources, conflict disclosure, and no paid record removal.

### Activist Capture (§32.3)

Contributors may try to use the platform to punish politically disfavored channels.
**Controls:** ownership-only scope, no ideological scoring, a neutral taxonomy, the
source hierarchy, reviewer diversity, and auditable decisions.

### Data Poisoning (§32.4)

Attackers may create fake press releases, domains, or documents.
**Controls:** domain-age checks, publisher validation, official registry
verification, content hashing, archive checks, and cross-source corroboration.

### Extension Compromise (§32.5)

A compromised extension could observe users or inject malicious code.
**Controls:** minimal permissions, a strict content security policy, reproducible
builds, signed releases, dependency scanning, no remotely executed code, public
source code, and security audits.

### API Enumeration (§32.6)

Bulk users may scrape the entire dataset — which may be acceptable, since the
dataset is intended to be public.
**Controls (to protect operational systems):** rate limits, separate public data
dumps, API keys for bulk access, read replicas, and abuse monitoring.
