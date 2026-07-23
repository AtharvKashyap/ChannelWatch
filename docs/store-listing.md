# CHANNELWATCH — Chrome Web Store Listing Draft

Copy-ready draft for the Chrome Web Store submission. All ownership-related
wording is consistent with the reviewed copy module
(`packages/schemas/src/copy.ts`), `MANIFESTO.md`, and the SPEC §23.1 safer
language: it describes what the extension does and never implies misconduct,
guilt, or editorial interference. Fill the fields marked **[HUMAN]** at
submission time.

---

## Store name

```
CHANNELWATCH — YouTube ownership transparency
```

(Item name in the manifest is `CHANNELWATCH`; the store display name may append
the neutral tagline above. Keep under the 45-character store limit — the string
above is 44.)

## Category

**Productivity** (secondary consideration: _News & Weather_). The extension adds
contextual information to pages the user already views; Productivity best matches
a browsing-context tool.

## Language

English (US) at launch.

## Short description (max 132 chars)

```
See who owns, finances, or operates the YouTube channel you're watching — with sourced, human-reviewed evidence.
```

(111 characters.)

## Long description

```
CHANNELWATCH shows YouTube viewers who owns, finances, or operates the
channels they watch.

When you visit a YouTube watch page or channel page, CHANNELWATCH places a
small badge near the channel name describing the channel's ownership
structure — for example Independent, Creator-Owned, Corporate-Owned, or
PE-Backed. Click the badge to open a panel with the ownership chain, the
public sources behind it, a confidence level, and when the record was last
reviewed.

Evidence-first and human-reviewed:
- Every published claim is supported by public evidence and reviewed by a
  person before it appears.
- Financial ownership, operational control, and creative influence are
  described separately. Acquisition is not guilt, and investment is not proof
  of editorial control.
- When the evidence is thin, the honest answer is that ownership is unknown —
  never a guess.
- Badges describe ownership structure, not wrongdoing.

Built for privacy:
- To look up a channel the extension sends only the YouTube channel ID and the
  extension version. Nothing else.
- No browsing history, no watch history, no search queries, no account
  identity, no cookies.
- No telemetry by default. Any future analytics are strictly opt-in and never
  include which channels or videos you viewed.

Open and correctable:
- The source code and research methodology are public.
- Anyone — creators, companies, or members of the public — can ask us to
  review a published record. Corrections are logged and kept visible rather
  than silently rewritten.

CHANNELWATCH does not tell you what to watch. It gives you enough context to
decide for yourself.
```

Every claim in this description is backed by `PRIVACY.md`, `MANIFESTO.md`, and
`SITE_COPY`/`POPUP_COPY` in `copy.ts`. Do not add wording that implies a channel
did anything wrong.

---

## Permission justifications (Google's expected format)

Google asks, per requested permission, _why the item needs it_. The manifest
(`apps/extension/manifest.config.ts`) requests exactly one API permission plus
two host-permission patterns.

### `storage`

```
Used to cache ownership lookup results locally and to store the user's own
settings (badge scope, hide-creator-owned, only-confirmed, and the API origin).
Caching avoids repeat network requests for the same channel; results are kept
only for a short time-to-live. No browsing or viewing history is stored.
```

### Host permission — `https://www.youtube.com/*`

```
Required so the content script can read the public channel identifier already
present on the YouTube page the user is viewing, and render the ownership badge
next to the channel name. The extension only reads the channel ID; it does not
read watch history, search queries, comments, or account information.
```

### Host permission — production API origin (`https://<api-domain>/*`)

```
Required so the background service worker can look up ownership records for the
channel the user is viewing. The only data sent is the YouTube channel ID and
the extension version. This origin is fixed at build time and is the sole
backend the extension contacts besides youtube.com.
```

**[HUMAN]** Replace `<api-domain>` with the production API domain chosen in the
launch checklist §6.1. This value is baked into the manifest at build time from
`VITE_API_BASE_URL` — the justification must name the exact origin in the
submitted bundle.

### Single-purpose statement (required by Google)

```
CHANNELWATCH has one purpose: to show the ownership, financing, and operational
structure of the YouTube channel the user is currently viewing, with links to
the public evidence behind each claim.
```

### Remote code

```
No. The extension executes no remotely hosted code. All logic ships in the
bundle; the only network calls are ownership lookups to the fixed API origin.
```

**Permissions flagged for human review:** none. Every requested permission maps
to an obvious, single-purpose justification above, and the manifest requests no
permission beyond `storage` + the two host patterns. If a future manifest change
adds `tabs`, `cookies`, `scripting`, `webRequest`, or broader host access, it
MUST be re-flagged here and re-reviewed against SPEC §18.7 and `CLAUDE.md` rule 5
before submission.

---

## Privacy practices disclosures (Web Store form)

Answer the "Privacy practices" tab to match `PRIVACY.md` exactly:

- **Single purpose:** as stated above.
- **Data collected:** the extension does **not** collect or transmit personal or
  sensitive user data. The only outbound data is the public YouTube channel ID
  and the extension version, sent to perform an ownership lookup — this is not
  user-identifying. Declare **no** collection in every personal-data category
  (location, personally identifiable info, health, financial, authentication,
  personal communications, web history, user activity, website content).
- **Telemetry:** none by default; any future telemetry is opt-in and excludes
  channel/video viewing (state "not collected" at launch).
- **Sale/transfer:** data is **not** sold or transferred to third parties.
- **Use limitation:** data is **not** used for purposes unrelated to the single
  purpose, and **not** used for creditworthiness/lending.
- **Privacy policy URL:** **[HUMAN]** the public URL where `PRIVACY.md` is
  hosted (launch checklist §3.1).

These answers are consistent with `PRIVACY.md` "What the Extension Sends" and
"What We Never Collect". If any answer would differ from `PRIVACY.md`, stop —
the policy is the source of truth.

---

## Screenshots checklist

Chrome Web Store requires at least one 1280×800 (or 640×400) screenshot; up to
five recommended. Capture on a researched channel (see the manual E2E script in
`apps/extension/README.md`, e.g. Little Baby Bum) so the panel shows real,
sourced content.

- [ ] **1 — Badge in context.** The ownership badge next to a channel name on a
      YouTube watch page (e.g. an orange "PE-Backed · <owner>" chip). Caption:
      "See the ownership structure right where you watch."
- [ ] **2 — Ownership panel open.** The evidence panel showing the ownership
      chain, confidence level, and the "No conclusion is made about editorial
      interference" disclaimer. Caption: "Every claim links to public sources."
- [ ] **3 — Evidence / sources list.** The panel scrolled to the source
      citations. Caption: "Sourced and human-reviewed."
- [ ] **4 — Settings page.** The options page (badge scope, hide-creator-owned,
      only-confirmed). Caption: "You control when badges appear."
- [ ] **5 — Unresearched / unknown state.** A channel with no record showing the
      neutral "Not yet researched" state. Caption: "When we don't know, we say
      so."

Screenshot rules: use a real researched channel, do not fabricate a badge or
ownership claim, and blur nothing that would misrepresent the product. Do not
stage a screenshot that implies a channel engaged in misconduct.

**Promo assets [HUMAN]:** small promo tile (440×280) and icon (128×128) — not in
this repo; produce before submission.

---

## Pre-submission blockers (cross-refs)

- Bump `version` in `apps/extension/manifest.config.ts` from `0.0.0` to a real
  release version (`docs/reproducible-build.md`).
- Build with `VITE_API_BASE_URL` set to the production HTTPS origin, not the
  localhost default (launch checklist §4.2).
- Publish the privacy policy and paste its URL (launch checklist §3.1).
