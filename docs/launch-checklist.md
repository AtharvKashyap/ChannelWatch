# CHANNELWATCH Pre-Launch Checklist

Actionable gate for the first large-scale public launch (M3 launch prep;
`docs/roadmap.md` M3, SPEC §23.4). Every item has a **status**:

- **PASS** — a control is in place and verifiable in this repo today.
- **NEEDS-HUMAN** — a control exists in code/policy but launch requires a human
  decision, sign-off, or an external action (e.g. a lawyer, a DNS change) that
  cannot be satisfied by code alone.
- **GAP** — no control yet; must be built or explicitly waived before launch.

> **This document is not legal advice, and this audit is not a legal review.**
> It is an engineering self-audit that maps each SPEC §23.4 review topic to the
> specific project control intended to address it, so a **licensed attorney**
> can review efficiently. Item 1 below (external legal review) is
> **MVP-blocking** and can only be discharged by a qualified lawyer in the
> relevant jurisdiction(s). Nothing here substitutes for that review.

Counts: **6 PASS · 18 NEEDS-HUMAN · 6 GAP** (33 items).

---

## 1. Pre-launch legal review (SPEC §23.4) — MVP-BLOCKING

Obtain review by a licensed attorney covering every topic below. Each row names
the in-repo control that already addresses the topic and the evidence a lawyer
should inspect. **Status here reflects only whether the engineering control
exists — the legal sign-off itself is NEEDS-HUMAN in every row until an attorney
signs off.** See `docs/legal-risk.md` §4.

| #    | §23.4 topic                               | Control in this repo                                                                                                                                     | Evidence to review                                                                                                                          | Control status                                              |
| ---- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1.1  | **Defamation**                            | Safer-language enforcement: all ownership prose flows through the reviewed copy module; no ad-hoc strings. "Describe structure, never imply misconduct." | `packages/schemas/src/copy.ts`; `docs/legal-risk.md` §1; `packages/schemas/tests/copy.test.ts`; the self-audit `docs/launch-legal-audit.md` | PASS                                                        |
| 1.2  | **Defamation** — facts vs. interpretation | Every panel separates Verified Fact / Unknown / Interpretation and carries the standing "No conclusion is made about editorial interference" disclaimer  | `docs/legal-risk.md` §2; `EDITORIAL_DISCLAIMER` in `copy.ts`; `apps/extension/src/content/ownership-panel.tsx`                              | PASS                                                        |
| 1.3  | **Defamation** — precision over recall    | Publication thresholds; PE-backed label requires ≥1 Tier-1 or 2 independent Tier-2 sources; two-person review for sensitive claims                       | `packages/scoring/src/publication.ts`; `CLAUDE.md` rules 1, 8; `services/api/tests/two-person.test.ts`                                      | PASS                                                        |
| 1.4  | **Copyright**                             | Records store sourced excerpts + citations, not wholesale copies; evidence policy limits what is reproduced                                              | `docs/evidence-policy.md`; `data/research/_TEMPLATE.yaml`                                                                                   | NEEDS-HUMAN (confirm excerpt length / fair-use posture)     |
| 1.5  | **Database rights**                       | Dataset is first-party research compiled from public sources; provenance recorded per record                                                             | `data/research/*.yaml`; `docs/METHODOLOGY.md`                                                                                               | NEEDS-HUMAN (sui generis DB-right exposure in EU/UK)        |
| 1.6  | **Terms of service** (YouTube)            | Extension reads only the public DOM already served to the logged-in user; sends only channel ID + version; no scraping of YouTube's private APIs         | `PRIVACY.md`; `apps/extension/manifest.config.ts`; `apps/extension/src/content/`                                                            | NEEDS-HUMAN (YouTube ToS review)                            |
| 1.7  | **Web scraping**                          | No server-side crawling of YouTube; the extension operates in the user's own browser session on pages they already loaded                                | `apps/extension/src/content/youtube-observer.ts`; SECURITY.md §32.6                                                                         | NEEDS-HUMAN                                                 |
| 1.8  | **Fair use**                              | Sourced excerpts are short, attributed, and used for commentary/transparency                                                                             | `docs/evidence-policy.md`                                                                                                                   | NEEDS-HUMAN                                                 |
| 1.9  | **Data protection** (GDPR/CCPA)           | Viewer data minimization (channel ID + version only, no telemetry by default); subject-data limits (no home address, phone, family, etc.)                | `PRIVACY.md`; `docs/evidence-policy.md` §5; SPEC §22.4                                                                                      | NEEDS-HUMAN (lawful basis, DPA, controller/processor roles) |
| 1.10 | **Right of reply**                        | Anyone may submit a correction/appeal; disputes can show a public notice while under review                                                              | `docs/legal-risk.md` §3; SPEC §24; `apps/web/src/app/corrections/page.tsx`                                                                  | PASS                                                        |
| 1.11 | **Record retention**                      | Audit trail on every mutation; corrections keep prior state visible; cache TTLs bound client retention                                                   | `CLAUDE.md` rule 6; `services/api` audit middleware; cache TTLs in `apps/extension/src/background/ttl.ts`                                   | NEEDS-HUMAN (define a written retention schedule)           |
| 1.12 | **Safe-harbor procedures**                | Correction/appeal intake + audit trail exist; a formal notice-and-takedown / DMCA agent designation does not                                             | `docs/legal-risk.md` §3                                                                                                                     | GAP (designate a DMCA/notice agent + published process)     |

**Action:** engage counsel; walk each row above; capture written sign-off per
topic. Do not launch publicly until 1.1–1.12 are signed off and the GAP in 1.12
is closed or waived in writing.

---

## 2. Two-person review completion gate (SPEC §20.3)

- [ ] **2.1 — All flagged records have two distinct approvals.** Sensitive
      claims (hidden ownership, undisclosed acquisition, fraud/misrepresentation,
      editorial interference, political influence, named individuals) require two
      reviewers before publication. **NEEDS-HUMAN** — enforcement is in code
      (`services/api/tests/two-person.test.ts`, `REVIEW_CONSOLE_COPY`
      sensitive-flag copy), but launch requires confirming every currently-flagged
      record in `data/research/*.yaml` actually carries both approvals. Query the
      review console queue for any record in the "awaiting second reviewer" state
      and clear it.
- [ ] **2.2 — No draft records are publicly reachable.** Records are drafts until
      a human sets `reviewed_by`; the whole-graph recompute is the single writer
      of `published_classification` (`CLAUDE.md` Status; importer per-record label
      is informational only). **NEEDS-HUMAN** — verify no unreviewed draft is
      exposed by the public API before launch.

---

## 3. Privacy policy publication

- [ ] **3.1 — Publish `PRIVACY.md` at a stable public URL** and link it from the
      Chrome Web Store listing and the web app footer. **NEEDS-HUMAN** (hosting +
      link). Content control is **PASS** (`PRIVACY.md` exists and matches the
      extension behavior; see `docs/store-listing.md` privacy disclosures).
- [ ] **3.2 — Chrome Web Store data-practices form matches `PRIVACY.md`.**
      Declare: channel-ID-only lookups, no telemetry by default, no sale of data.
      **NEEDS-HUMAN** — fill the Web Store form per `docs/store-listing.md`.

---

## 4. Extension permission audit (SPEC §18.7)

- [x] **4.1 — Minimal permissions verified.** Manifest requests only `storage`
      plus host access to `https://www.youtube.com/*` and the configured API
      origin. No `tabs`, `cookies`, `identity`, `webRequest`, or broad host
      access. **PASS** — `apps/extension/manifest.config.ts`; baked manifest
      verified in `docs/reproducible-build.md`.
- [ ] **4.2 — Host permission points at the production API, not localhost.** The
      API origin is baked from `VITE_API_BASE_URL`; if unset it defaults to
      `http://localhost:8787`. **NEEDS-HUMAN** — the store build MUST set
      `VITE_API_BASE_URL` to the production HTTPS origin (see
      `docs/reproducible-build.md`). A store bundle pointing at localhost is a
      hard blocker.
- [ ] **4.3 — Each permission has a store justification.** **PASS** for content
      (see `docs/store-listing.md` permission justifications); **NEEDS-HUMAN** to
      paste into the Web Store console.

---

## 5. API rate-limit / abuse posture (SPEC §19.1, §32.6)

- [x] **5.1 — Public rate limits in place.** Reads 60/min/IP, POSTs 5/min/IP
      (in-memory token bucket); 32 KB POST body cap → 413. **PASS** —
      `services/api/src/routes.ts`; `services/api/tests/rate-limit.test.ts`.
- [x] **5.2 — Scoped CORS + security headers + uniform error envelope.** CORS is
      scoped to the web origin (`WEB_ORIGIN`) plus extension origins. **PASS** —
      `services/api/src/http/middleware.ts`, `services/api/src/index.ts`.
- [ ] **5.3 — Rate limiting survives horizontal scale.** The token bucket is
      **in-memory per process**, so limits reset on restart and are per-instance.
      **GAP** — for multi-instance production, move to a shared store (e.g. Redis)
      or a gateway/CDN rate limiter, or document single-instance as an accepted
      launch constraint.
- [ ] **5.4 — Abuse monitoring / bulk-access policy.** SECURITY.md §32.6 names
      separate public data dumps + API keys for bulk access as the intended
      controls; neither is built. **GAP** — decide launch posture (scraping the
      public dataset may be acceptable per §32.6); at minimum enable request
      logging + alerting on the production host.

---

## 6. DNS / hosting decisions to make

All **NEEDS-HUMAN** — these are launch-time infrastructure decisions, not code:

- [ ] **6.1 — Register the production domain** and decide the public API origin
      (spec placeholder is `api.channelwatch.example`). This value is baked into
      the extension at build time and cannot change without a new store release —
      choose it deliberately. See `docs/reproducible-build.md` §"API origin".
- [ ] **6.2 — TLS/HTTPS** on the API and web origins (managed cert). The manifest
      host permission is `https://` only.
- [ ] **6.3 — Set `WEB_ORIGIN`** on the API deploy so CORS admits the production
      web app (`services/api/src/index.ts`).
- [ ] **6.4 — Update `SECURITY.md` contact.** The security email is a placeholder
      (`security@channelwatch.example`) — set a real inbox and/or enable GitHub
      private security advisories before launch.
- [ ] **6.5 — Managed Postgres** with backups; run `pnpm db:migrate` on deploy.
- [ ] **6.6 — Designate a legal/abuse/notice contact** (ties to item 1.12).

---

## 7. Monitoring basics

- [ ] **7.1 — Uptime + error alerting** on the API (5xx rate, latency). **GAP.**
- [ ] **7.2 — Structured request logging** on the production host (feeds 5.4).
      **GAP.**
- [ ] **7.3 — Selector-health signal.** The selector-health suite
      (`tests/selector_health/`) is the canary for YouTube DOM changes that would
      silently disable badges. **PASS** in CI; **NEEDS-HUMAN** to schedule a
      recurring run against fresh snapshots post-launch.
- [ ] **7.4 — Correction-queue SLA.** Corrections must be "processed promptly"
      (`docs/legal-risk.md` §3). **NEEDS-HUMAN** — assign an owner + response
      target before inviting public corrections.
- [ ] **7.5 — Extension error/telemetry (opt-in only).** Any telemetry must stay
      opt-in and channel-viewing-free (`PRIVACY.md` §Telemetry). **NEEDS-HUMAN**
      if enabling at launch; otherwise leave disabled (the current default).

---

## Launch gate summary

Do not flip to public launch until: item 1 (legal review) is signed off; the
1.12 safe-harbor GAP is closed or waived; item 2 (two-person review) is
confirmed complete; item 4.2 (production API origin baked) is verified; and the
DNS/hosting decisions in §6 are made. The §5.3, §5.4, §7.1, §7.2 GAPs should be
closed or explicitly accepted as documented launch constraints.
