# CHANNELWATCH — Founding Spec

> Original brainstormed specification (2026-07-21), preserved verbatim as the founding
> reference document. Where this spec and `docs/plan.md` disagree (e.g., the backend is
> TypeScript, not Python; the reviewer console is merged into `apps/web`), **the plan wins**.

## A Browser Extension for Detecting Ownership Changes, Private Equity Influence, and Commercial Capture of YouTube Channels

> **Channels should be judged by what they publish, but viewers deserve to know who may be influencing what gets published.**

---

# 1. Project Overview

**CHANNELWATCH** is an open-source browser extension and public research platform that helps viewers understand who owns, finances, operates, or commercially influences YouTube channels.

The extension adds a small ownership indicator to YouTube channel pages, video pages, search results, recommendations, and subscription feeds.

For each channel, it may display information such as:

- Whether the channel appears independently owned.
- Whether it was acquired by a media company.
- Whether its parent company is backed by private equity.
- Whether the original creator remains involved.
- Whether ownership changed recently.
- Whether the channel belongs to a larger network of coordinated channels.
- Whether there is insufficient public evidence to make a determination.
- Which public sources support the classification.

The system must never present uncertain ownership claims as established fact.

Its central output is not:

> "This channel was bought out."

Its central output is:

> "Public evidence indicates that this channel is owned by Company X, whose controlling investor is Firm Y. Confidence: high. Sources: acquisition announcement, corporate registry, and portfolio listing."

---

# 2. Problem Statement

YouTube viewers often form long-term relationships with individual creators and channels. Over time, some channels are:

- Acquired by media companies.
- Purchased by holding companies.
- Rolled into multi-channel networks.
- Financed by private equity firms.
- Operated by creator-management companies.
- Quietly transferred to new management.
- Converted into content brands after the original creator leaves.
- Consolidated into large portfolios without clear disclosure to viewers.

These changes may affect:

- Editorial independence.
- Sponsorship volume.
- Product placement.
- Upload frequency.
- Thumbnail and title strategy.
- Political or commercial messaging.
- Content quality.
- Treatment of employees and contractors.
- The use of artificial intelligence or outsourced production.
- The relationship between the audience and the original creator.

The information may exist across press releases, company websites, corporate filings, creator interviews, investment portfolios, domain registrations, and news reporting, but it is fragmented and difficult for ordinary viewers to interpret.

CHANNELWATCH aggregates this evidence and presents it directly within the viewing experience.

---

# 3. Core Philosophy

CHANNELWATCH is based on five principles.

## 3.1 Viewers Deserve Context

A viewer should be able to distinguish between:

- A creator-owned channel.
- A channel partially funded by outside investors.
- A channel acquired by a media company.
- A channel ultimately controlled by a private equity firm.
- A brand that merely licenses content from a creator.
- A channel whose ownership is unknown.

## 3.2 Evidence Must Be Visible

Every classification must be supported by inspectable evidence.

No hidden model should be allowed to make an unreviewable accusation.

## 3.3 Uncertainty Must Be Explicit

The system must distinguish between:

- Confirmed.
- Strongly supported.
- Probable.
- Unclear.
- Disputed.
- Outdated.
- Incorrect.

## 3.4 Ownership Is Not Automatically Wrong

The project should not claim that all acquisitions, investors, media groups, or private equity ownership are inherently malicious.

The project exists to provide transparency, not automatic condemnation.

## 3.5 People Must Be Able to Correct the Record

Creators, companies, researchers, and viewers must be able to:

- Submit evidence.
- Challenge incorrect classifications.
- Request corrections.
- Explain unusual corporate structures.
- Provide updated ownership information.

---

# 4. Manifesto

## The CHANNELWATCH Manifesto

The internet taught us to recognize creators by their voices, faces, habits, stories, and ideas.

We subscribed to people.

We trusted channels because they felt personal.

But online identity has become an asset class.

A channel can be acquired without changing its name. A familiar creator can become the face of a company they no longer control. A production team can be replaced. A catalog can be repackaged. A community can be inherited by owners the community never chose.

The interface rarely tells us when this happens.

The profile picture remains the same.

The channel name remains the same.

The recommendation system continues as though nothing changed.

But ownership matters.

Ownership can shape incentives. It can influence what gets produced, what gets removed, which sponsors are accepted, how employees are treated, how aggressively content is monetized, and whether the relationship between creator and audience remains authentic.

Transparency should not depend on viewers conducting corporate investigations.

We believe viewers deserve to know when a channel has changed hands.

We believe public claims should be supported by public evidence.

We believe uncertainty should be admitted rather than disguised.

We believe creators should be protected from speculation, harassment, and false accusations.

We believe acquisition is not guilt.

We believe investment is not proof of editorial control.

We believe financial ownership, operational control, and creative influence are different things and should be described separately.

We reject opaque blacklists.

We reject anonymous accusations presented as fact.

We reject ideological scoring systems that disguise opinions as ownership research.

We reject surveillance of viewers.

We reject the collection of unnecessary browsing histories.

We reject the assumption that every successful creator must secretly be controlled by a corporation.

CHANNELWATCH will be transparent about its sources, methods, funding, limitations, and mistakes.

Every conclusion should be traceable.

Every disputed record should be reviewable.

Every correction should remain visible.

Every user should be able to inspect why a label appears.

The goal is not to tell people what to watch.

The goal is to give them enough context to decide for themselves.

---

# 5. Goals and Non-Goals

## 5.1 Primary Goals

CHANNELWATCH should:

1. Detect publicly documented ownership changes involving YouTube channels.
2. Identify direct and ultimate parent organizations.
3. Determine whether an owner or parent organization is private-equity-backed.
4. Distinguish financial investment from operational control.
5. Show supporting evidence directly in the extension.
6. Maintain an auditable history of ownership changes.
7. Provide a public correction and appeal process.
8. Minimize collection of user browsing data.
9. Support community research without turning into a rumor platform.
10. Offer an open dataset and API for researchers.

## 5.2 Non-Goals

CHANNELWATCH should not:

- Decide whether a channel is morally good or bad.
- Infer ownership solely from changes in content quality.
- Label creators based on political views.
- Track individual viewing histories.
- Reveal private personal information.
- Scrape or republish confidential documents.
- Encourage harassment of creators or employees.
- Treat sponsorships as proof of ownership.
- Treat management representation as proof of acquisition.
- Automatically publish LLM-generated accusations.
- Claim editorial interference without evidence.
- Rank channels by ideological desirability.

---

# 6. What the Extension Should Detect

The system should model several distinct concepts.

## 6.1 Direct Channel Ownership

The legal or practical entity that owns or controls the channel.

Examples:

- The creator personally.
- A creator-owned LLC.
- A production company.
- A media company.
- A multi-channel network.
- A brand holding company.
- An unknown entity.

## 6.2 Ultimate Parent Ownership

The organization at the top of the control chain.

Example:

```text
YouTube Channel
    ↓
Production Company LLC
    ↓
Digital Media Holding Company
    ↓
Portfolio Company
    ↓
Private Equity Fund
```

## 6.3 Financial Backing

A company may receive funding without being controlled by the investor.

The extension must differentiate:

- Minority investment.
- Majority investment.
- Growth equity.
- Debt financing.
- Acquisition.
- Merger.
- Joint venture.
- Licensing agreement.
- Management agreement.
- Revenue-sharing agreement.
- Unknown investment terms.

## 6.4 Operational Control

Operational control may include:

- Hiring and firing authority.
- Editorial management.
- Production management.
- Distribution control.
- Advertising sales.
- Sponsor management.
- Intellectual property ownership.
- Channel account access.
- Budget authority.

Operational control should only be claimed where supported by evidence.

## 6.5 Creator Involvement

Possible states:

- Creator-owned and operated.
- Creator-owned with external management.
- Creator remains majority owner.
- Creator remains minority owner.
- Creator remains on-camera but not in control.
- Creator has exited.
- Creator involvement unclear.
- Channel is a corporate brand with no singular creator.

## 6.6 Ownership Change Timeline

Each record should include:

- Original ownership.
- Investment date.
- Acquisition announcement date.
- Closing date, when available.
- Restructuring events.
- Parent-company changes.
- Creator departure.
- Subsequent resale.
- Bankruptcy or dissolution.
- Current verification date.

---

# 7. Detection Philosophy

The system should use an **evidence-first classification process**.

Detection should never be based on a single unexplained score.

The platform should collect discrete claims such as:

```text
Claim:
Company A acquired a controlling stake in Channel B.

Evidence:
Company A press release dated 2025-03-12.

Corroboration:
Industry publication reporting the acquisition.

Confidence:
High.
```

The final ownership status should be assembled from reviewed claims.

## 7.1 Evidence Hierarchy

### Tier 1: Primary Authoritative Sources

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

### Tier 2: Reputable Secondary Sources

- Established business publications.
- Trade publications.
- Interviews with named executives.
- Investigative journalism.
- Financial databases with clear sourcing.
- Industry newsletters with accountable authorship.

### Tier 3: Supporting Technical Evidence

- Historical website ownership pages.
- Domain registration changes.
- Shared legal contact information.
- Shared advertising disclosures.
- Shared corporate addresses.
- Public employment records.
- App-store publisher changes.
- Archived terms-of-service pages.
- Channel business contact changes.

### Tier 4: Leads Only

- Social-media speculation.
- Reddit posts.
- Anonymous tips.
- Sudden stylistic changes.
- Similar thumbnails.
- Shared sponsors.
- Upload-pattern changes.
- Unverified leaked screenshots.

Tier 4 evidence may initiate research but must not independently support a published ownership claim.

---

# 8. Confidence and Evidence Model

Each claim should receive both an evidence classification and a confidence level.

## 8.1 Confidence Levels

### Confirmed

Use when the relationship is established through strong primary evidence.

Examples:

- Corporate filing.
- Official acquisition announcement.
- Owner portfolio listing.
- Direct creator confirmation.

### High Confidence

Use when multiple credible sources agree and no material contradiction exists.

### Moderate Confidence

Use when credible evidence exists but the exact ownership or control terms remain incomplete.

### Low Confidence

Use when evidence is suggestive but insufficient for a public ownership label.

Low-confidence claims should generally not produce a prominent warning.

### Disputed

Use when credible parties provide conflicting accounts.

### Unknown

Use when insufficient evidence exists.

## 8.2 Evidence Status

Each evidence item should be labeled:

```text
ACTIVE
SUPERSEDED
RETRACTED
DISPUTED
ARCHIVED
BROKEN_LINK
PENDING_REVIEW
```

## 8.3 Claim Status

```text
DRAFT
UNDER_REVIEW
PUBLISHED
DISPUTED
CORRECTED
RETRACTED
ARCHIVED
```

---

# 9. User Experience

## 9.1 Extension Badge

The extension should place a small badge near the channel name.

Possible labels:

```text
Independent
Creator-Owned
Externally Funded
Corporate-Owned
PE-Backed
Ownership Changed
Ownership Unclear
Disputed
```

A badge should describe ownership structure, not imply misconduct.

## 9.2 Badge Colors

Suggested semantic categories:

- Neutral: ownership unknown or not researched.
- Green: creator-owned or independently controlled.
- Blue: externally funded or managed.
- Purple: corporate-owned.
- Orange: private-equity-backed.
- Red: disputed or materially misleading public ownership information.

Red should not mean "private equity." It should be reserved for data-quality or disclosure conflicts.

## 9.3 Information Panel

Clicking the badge opens a panel containing:

```text
Channel: Example Channel

Current Classification:
Private-equity-backed media company

Direct Owner:
Example Media LLC

Ultimate Parent:
Example Holdings Group

Financial Sponsor:
Example Capital Partners

Creator Status:
Original creator remains host; ownership stake unknown

Ownership Change:
Acquisition announced March 12, 2025

Confidence:
High

Evidence:
1. Official acquisition announcement
2. Investor portfolio listing
3. Trade publication report

Last Reviewed:
July 18, 2026
```

## 9.4 Contextual Warnings

Warnings may appear when:

- Ownership changed within the last twelve months.
- The channel name and branding remained unchanged after acquisition.
- The original creator exited.
- A claimed independent channel is owned by a larger corporate group.
- Evidence is disputed.
- Ownership information is outdated.

## 9.5 User Controls

Users should be able to configure:

- Show badges everywhere.
- Show badges only on channel and video pages.
- Hide creator-owned badges.
- Highlight only recent ownership changes.
- Highlight only private-equity-backed channels.
- Disable community-submitted claims.
- Show only confirmed claims.
- Disable extension analytics.

---

# 10. System Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                      Browser Extension                       │
│                                                              │
│  YouTube DOM Detector                                        │
│  Channel ID Extractor                                        │
│  Badge Renderer                                              │
│  Ownership Panel                                             │
│  Local Cache                                                 │
└───────────────────────────────┬──────────────────────────────┘
                                │
                                │ HTTPS
                                ▼
┌──────────────────────────────────────────────────────────────┐
│                         Public API                           │
│                                                              │
│  Channel Lookup                                              │
│  Ownership Graph                                             │
│  Evidence Retrieval                                          │
│  Search                                                      │
│  Correction Submission                                       │
└───────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────┐
│                    Application Backend                       │
│                                                              │
│  Channel Registry                                            │
│  Entity Resolution                                           │
│  Ownership Graph Engine                                      │
│  Claim Management                                            │
│  Confidence Scoring                                          │
│  Review Workflow                                             │
│  Audit Logging                                               │
└───────────────┬────────────────────────────┬─────────────────┘
                │                            │
                ▼                            ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│      Research Pipeline   │    │       Reviewer Console       │
│                          │    │                              │
│ Source Discovery         │    │ Evidence Review              │
│ Web Monitoring           │    │ Claim Approval               │
│ Corporate Data Import    │    │ Conflict Resolution          │
│ Change Detection         │    │ Appeals                      │
│ Candidate Extraction     │    │ Retractions                  │
└───────────────┬──────────┘    └──────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────┐
│                        Data Layer                            │
│                                                              │
│ PostgreSQL                                                   │
│ Object Storage                                               │
│ Search Index                                                 │
│ Audit Ledger                                                 │
│ Redis Cache                                                  │
└──────────────────────────────────────────────────────────────┘
```

---

# 11. Data Sources

## 11.1 YouTube Metadata

Store only publicly available channel metadata necessary for matching.

Potential fields:

- Channel ID.
- Channel name.
- Handle.
- Channel URL.
- Description.
- Country, when publicly shown.
- Business links.
- External websites.
- Creation date.
- Profile image hash.
- Public contact organization, when displayed.
- Recent video metadata.

Do not store private viewer data.

## 11.2 Corporate Sources

Potential source classes:

- Corporate registries.
- Securities filings.
- Merger and acquisition announcements.
- Private equity portfolio pages.
- Company "About" pages.
- Investor-relations pages.
- Competition authority decisions.
- Bankruptcy records.
- Trademark ownership records.
- Copyright records.
- Public beneficial ownership disclosures where legally available.

## 11.3 Media and Journalism

- Business newspapers.
- Creator economy publications.
- Media industry publications.
- Technology publications.
- Local business journals.
- Interviews.
- Podcasts with owners or creators.
- Conference transcripts.

## 11.4 Historical Web Sources

- Web archives.
- Archived company team pages.
- Archived channel websites.
- Archived terms and privacy policies.
- Historical copyright notices.
- Historical press kits.

## 11.5 Community Submissions

Community submissions should require:

- A claim.
- A URL or document.
- A short explanation.
- The claimed relationship type.
- Optional identity disclosure to moderators.
- A declaration that the submission is made in good faith.

Anonymous submissions may be accepted as research leads but should carry less evidentiary weight.

---

# 12. Detection Pipeline

## 12.1 Stage 1: Channel Identification

Extract the immutable YouTube channel ID rather than relying only on:

- Display name.
- Handle.
- Custom URL.
- Creator name.

Channel names and handles can change.

## 12.2 Stage 2: Existing Record Lookup

Check whether the channel already exists in the database.

```text
Channel ID → Channel Record → Ownership Graph → Published Claims
```

## 12.3 Stage 3: Candidate Discovery

For unresearched channels, generate ownership candidates using:

- Channel website links.
- Copyright notices.
- Business email domains.
- Linked company websites.
- Public press releases.
- Corporate portfolio pages.
- Acquirer and investor databases.
- Historical metadata.
- News search.
- Community submissions.

## 12.4 Stage 4: Entity Resolution

Normalize references such as:

```text
Example Media
Example Media LLC
Example Media, Inc.
ExampleMedia
Example Media Group
```

into a canonical entity record.

Entity resolution should use:

- Legal names.
- Former names.
- Domains.
- Addresses.
- Executives.
- Registry identifiers.
- Parent relationships.
- Known aliases.

## 12.5 Stage 5: Claim Extraction

Create structured claims from evidence.

Example:

```json
{
  "subject": "entity:example-media",
  "predicate": "ACQUIRED",
  "object": "channel:UC123456",
  "effective_date": "2025-03-12",
  "ownership_percentage": null,
  "control_type": "UNKNOWN",
  "source_id": "source:official-announcement",
  "confidence": 0.96
}
```

## 12.6 Stage 6: Relationship Validation

Check:

- Does the source actually identify the channel?
- Does it identify the legal entity?
- Is the acquisition completed or merely proposed?
- Is the investor a minority or controlling shareholder?
- Has the ownership relationship since changed?
- Does the source date predate a later sale?
- Is the source quoting another source inaccurately?

## 12.7 Stage 7: Human Review

No sensitive classification should be published without review during the early stages of the project.

Reviewers verify:

- Source credibility.
- Entity matching.
- Relationship interpretation.
- Date accuracy.
- Confidence level.
- Wording.
- Potential defamation risk.

## 12.8 Stage 8: Publication

Approved claims become visible through:

- Browser extension.
- Public website.
- Public API.
- Data export.

## 12.9 Stage 9: Continuous Monitoring

Periodically monitor:

- Parent company pages.
- Portfolio pages.
- Acquisition news.
- Creator announcements.
- Corporate registry changes.
- Channel descriptions.
- Public websites.

A change should create a review task, not automatically replace a published record.

---

# 13. Signal Catalog

The system should distinguish strong ownership evidence from behavioral indicators.

## 13.1 Direct Ownership Signals

High-value signals:

- "We acquired Channel X."
- "Channel X has joined Company Y."
- Corporate filing naming the channel or related production company.
- Channel website naming a new parent company.
- Investor portfolio page listing the channel business.
- Trademark transferred to a new entity.
- Creator explicitly announcing a sale.
- Legal terms naming a new operator.

## 13.2 Private Equity Signals

A channel may be marked PE-backed when:

1. The channel is owned by a company.
2. That company is controlled or materially backed by another entity.
3. The controlling or backing entity is a private equity firm or PE-sponsored portfolio company.
4. The relationship is supported by evidence.

Store:

- PE firm.
- Fund name, when publicly available.
- Portfolio company.
- Investment date.
- Stake type.
- Exit date.
- Source.
- Control confidence.

## 13.3 Creator Exit Signals

Potential evidence:

- Creator departure announcement.
- Removal from company leadership pages.
- Sale announcement.
- Creator no longer appears in content.
- New host announcement.
- Creator interview describing exit.

Visual absence alone is not sufficient.

## 13.4 Operational Change Signals

These may justify investigation but not ownership classification:

- Sudden increase in upload frequency.
- New production style.
- Repeated thumbnail templates.
- Sponsor volume increase.
- Reused scripts across channels.
- Shared voiceover talent.
- Shared editing patterns.
- New business email domain.
- Copyright notice changes.
- New employment listings.
- Cross-promotion with an apparent channel network.

## 13.5 Shared Infrastructure Signals

Supporting evidence may include:

- Shared privacy policy.
- Shared terms of service.
- Shared business address.
- Shared contact domain.
- Shared analytics or advertising identifiers.
- Shared corporate officers.
- Shared website templates.
- Shared trademark owner.

These signals must be interpreted cautiously because service providers may support unrelated companies.

---

# 14. Scoring Model

The scoring model should estimate confidence in a specific claim, not calculate whether a company is "good" or "bad."

## 14.1 Suggested Evidence Weights

```text
Official regulatory filing                   1.00
Official acquisition announcement            0.95
Official investor portfolio listing          0.90
Direct creator confirmation                   0.90
Corporate registry record                     0.90
Reputable business publication                0.80
Established industry publication              0.75
Named executive interview                     0.75
Archived corporate page                       0.65
Trademark transfer                            0.65
Shared legal documentation                    0.60
Technical infrastructure linkage              0.35
Anonymous tip                                 0.10
Behavioral content change                     0.05
```

Weights should not simply be added.

The model should account for:

- Source independence.
- Corroboration.
- Recency.
- Directness.
- Contradiction.
- Entity-match quality.
- Whether the source states ownership or merely association.

## 14.2 Example Claim Confidence Formula

```text
claim_confidence =
    source_quality
    × directness
    × entity_match
    × recency_factor
    × corroboration_factor
    × contradiction_penalty
```

Example:

```text
source_quality         = 0.95
directness             = 1.00
entity_match           = 0.98
recency_factor         = 0.95
corroboration_factor   = 1.00
contradiction_penalty  = 1.00

confidence = 0.884
```

## 14.3 Publication Thresholds

```text
0.90–1.00  Confirmed
0.75–0.89  High Confidence
0.55–0.74  Moderate Confidence
0.30–0.54  Low Confidence
0.00–0.29  Research Lead Only
```

For publicly visible PE-backed labels, require:

- At least one Tier 1 source, or
- Two independent Tier 2 sources plus strong entity resolution.

---

# 15. Channel Ownership Graph

Ownership should be represented as a graph rather than a single text field.

## 15.1 Node Types

```text
CHANNEL
CREATOR
PERSON
COMPANY
SUBSIDIARY
MEDIA_NETWORK
INVESTMENT_FIRM
PRIVATE_EQUITY_FIRM
VENTURE_CAPITAL_FIRM
FUND
BRAND
TRUST
NONPROFIT
UNKNOWN_ENTITY
```

## 15.2 Relationship Types

```text
OWNS
PARTIALLY_OWNS
CONTROLS
OPERATES
MANAGES
FUNDS
INVESTED_IN
ACQUIRED
MERGED_WITH
LICENSES_FROM
REPRESENTS
FOUNDED_BY
HOSTED_BY
EMPLOYS
SUBSIDIARY_OF
PORTFOLIO_COMPANY_OF
CREATIVE_CONTROL_BY
DISTRIBUTED_BY
AD_SALES_BY
FORMERLY_OWNED_BY
```

## 15.3 Relationship Properties

```text
effective_from
effective_to
ownership_percentage
control_level
confidence
source_ids
review_status
notes
```

## 15.4 Example Graph

```text
Creator A
   │
   ├── FOUNDED_BY ──> Channel X
   │
   └── PARTIALLY_OWNS ──> Production Company

Production Company
   │
   ├── OWNS ──> Channel X
   │
   └── SUBSIDIARY_OF ──> Media Group

Media Group
   │
   └── PORTFOLIO_COMPANY_OF ──> PE Firm
```

---

# 16. Database Design

PostgreSQL is sufficient for the first version.

A graph database may be added later but is not necessary for the MVP.

## 16.1 Core Tables

### `channels`

```sql
id UUID PRIMARY KEY
youtube_channel_id TEXT UNIQUE NOT NULL
handle TEXT
display_name TEXT NOT NULL
description TEXT
channel_url TEXT
country_code TEXT
thumbnail_url TEXT
subscriber_range TEXT
first_seen_at TIMESTAMPTZ
last_seen_at TIMESTAMPTZ
research_status TEXT
published_classification TEXT
classification_confidence NUMERIC
last_reviewed_at TIMESTAMPTZ
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### `entities`

```sql
id UUID PRIMARY KEY
entity_type TEXT NOT NULL
canonical_name TEXT NOT NULL
legal_name TEXT
jurisdiction TEXT
registry_identifier TEXT
website TEXT
description TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### `entity_aliases`

```sql
id UUID PRIMARY KEY
entity_id UUID REFERENCES entities(id)
alias TEXT NOT NULL
alias_type TEXT
source_id UUID
```

### `relationships`

```sql
id UUID PRIMARY KEY
subject_entity_id UUID
subject_channel_id UUID
relationship_type TEXT NOT NULL
object_entity_id UUID
object_channel_id UUID
ownership_percentage NUMERIC
control_level TEXT
effective_from DATE
effective_to DATE
confidence NUMERIC
status TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### `sources`

```sql
id UUID PRIMARY KEY
url TEXT NOT NULL
title TEXT
publisher TEXT
author TEXT
published_at TIMESTAMPTZ
retrieved_at TIMESTAMPTZ
source_tier INTEGER
source_type TEXT
archive_url TEXT
content_hash TEXT
status TEXT
```

### `claims`

```sql
id UUID PRIMARY KEY
subject_type TEXT NOT NULL
subject_id UUID NOT NULL
predicate TEXT NOT NULL
object_type TEXT
object_id UUID
literal_value JSONB
confidence NUMERIC
claim_status TEXT
effective_date DATE
expiration_date DATE
review_notes TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### `claim_sources`

```sql
claim_id UUID REFERENCES claims(id)
source_id UUID REFERENCES sources(id)
support_type TEXT
quoted_excerpt TEXT
locator TEXT
PRIMARY KEY (claim_id, source_id)
```

### `reviews`

```sql
id UUID PRIMARY KEY
claim_id UUID REFERENCES claims(id)
reviewer_id UUID
decision TEXT
reasoning TEXT
reviewed_at TIMESTAMPTZ
```

### `correction_requests`

```sql
id UUID PRIMARY KEY
channel_id UUID
claim_id UUID
submitter_name TEXT
submitter_email TEXT
submitter_relationship TEXT
explanation TEXT
status TEXT
submitted_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ
resolution TEXT
```

### `audit_events`

```sql
id UUID PRIMARY KEY
actor_id UUID
action TEXT NOT NULL
object_type TEXT NOT NULL
object_id UUID
before_state JSONB
after_state JSONB
created_at TIMESTAMPTZ
```

---

# 17. API Design

Base path:

```text
/api/v1
```

## 17.1 Public Endpoints

### Channel Lookup

```http
GET /api/v1/channels/youtube/{youtube_channel_id}
```

### Channel Search

```http
GET /api/v1/channels/search?q={query}
```

### Ownership Graph

```http
GET /api/v1/channels/{channel_id}/ownership
```

### Evidence

```http
GET /api/v1/channels/{channel_id}/evidence
```

### Ownership Timeline

```http
GET /api/v1/channels/{channel_id}/timeline
```

### Entity Lookup

```http
GET /api/v1/entities/{entity_id}
```

### Submit Research Lead

```http
POST /api/v1/submissions
```

### Submit Correction

```http
POST /api/v1/corrections
```

## 17.2 Example Response

```json
{
  "youtube_channel_id": "UC123456789",
  "display_name": "Example Channel",
  "classification": {
    "label": "PE_BACKED",
    "confidence": 0.93,
    "confidence_label": "CONFIRMED",
    "summary": "Owned by Example Media, a portfolio company of Example Capital."
  },
  "direct_owner": {
    "id": "entity-123",
    "name": "Example Media LLC",
    "type": "COMPANY"
  },
  "ultimate_parent": {
    "id": "entity-456",
    "name": "Example Capital Partners",
    "type": "PRIVATE_EQUITY_FIRM"
  },
  "creator_status": {
    "status": "REMAINS_HOST",
    "ownership_stake": "UNKNOWN"
  },
  "last_reviewed_at": "2026-07-18T14:30:00Z",
  "evidence_count": 4,
  "disputed": false
}
```

---

# 18. Browser Extension Design

## 18.1 Extension Platform

Support:

- Chrome.
- Chromium browsers.
- Firefox.
- Edge.

Use Manifest V3 where required.

## 18.2 Extension Components

```text
Background Service Worker
Content Script
YouTube Route Observer
Channel ID Resolver
API Client
Local Cache
Badge Renderer
Ownership Drawer
Settings Page
Error Reporter
```

## 18.3 YouTube Page Types

Support:

- Video watch pages.
- Channel home pages.
- Search results.
- Homepage recommendations.
- Subscription feed.
- Shorts.
- Playlist pages.
- Comment sections.
- Community posts.

## 18.4 Channel Identification

Preferred order:

1. Extract channel ID from structured page data.
2. Read canonical channel URL.
3. Resolve handle through the backend.
4. Use YouTube metadata endpoint where permitted.
5. Avoid matching solely by display name.

## 18.5 DOM Resilience

YouTube frequently changes its frontend.

The extension should:

- Use multiple selectors.
- Observe route changes.
- Use a `MutationObserver`.
- Debounce rerendering.
- Keep selector definitions centralized.
- Include automated selector-health tests.
- Fail silently rather than breaking the page.

## 18.6 Local Caching

Cache channel records locally.

Example:

```text
Confirmed record: 7 days
Recently changed record: 6 hours
Unknown channel: 24 hours
API error: 10 minutes
Disputed record: 1 hour
```

Do not store a long-term history of every channel viewed.

## 18.7 Permissions

Keep permissions minimal.

Likely permissions:

```json
{
  "permissions": ["storage"],
  "host_permissions": [
    "https://www.youtube.com/*",
    "https://api.channelwatch.example/*"
  ]
}
```

Avoid:

- Full browsing history.
- Tabs permission unless essential.
- Cookies.
- Identity permissions.
- Access to unrelated websites.

---

# 19. Backend Services

## 19.1 API Service

Responsibilities:

- Public channel lookups.
- Evidence retrieval.
- Rate limiting.
- Authentication for reviewers.
- Cache management.
- Request validation.

## 19.2 Research Worker

Responsibilities:

- Process unresearched channels.
- Discover candidate sources.
- Run entity resolution.
- Create draft claims.
- Schedule refresh tasks.

## 19.3 Source Monitor

Responsibilities:

- Monitor known owner and investor pages.
- Detect page changes.
- Archive new versions.
- Create review tasks.

## 19.4 Evidence Archive

Responsibilities:

- Store source metadata.
- Store cryptographic content hashes.
- Preserve legally permissible excerpts.
- Record archive links.
- Detect changed or removed sources.

Do not mirror entire copyrighted articles unless legally permitted.

## 19.5 Review Console

Reviewer capabilities:

- View candidate claims.
- Compare source excerpts.
- Inspect entity matches.
- Approve or reject relationships.
- Set confidence.
- Mark disputes.
- Publish corrections.
- Review audit history.

---

# 20. Research and Review Workflow

## 20.1 Research Queue States

```text
UNRESEARCHED
DISCOVERY_RUNNING
CANDIDATES_FOUND
NEEDS_REVIEW
RESEARCH_INCOMPLETE
APPROVED
PUBLISHED
DISPUTED
RECHECK_REQUIRED
ARCHIVED
```

## 20.2 Review Checklist

Before publishing an ownership claim:

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

## 20.3 Two-Person Review

For high-risk claims involving:

- Hidden ownership.
- Undisclosed acquisition.
- Fraud.
- Misrepresentation.
- Editorial interference.
- Political influence.
- Named individuals.

Require approval from two reviewers before publication.

---

# 21. Machine Learning and LLM Usage

LLMs may help with research, but must not act as autonomous publishers.

## 21.1 Appropriate Uses

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

## 21.2 Inappropriate Uses

LLMs must not:

- Decide that a channel was acquired based on style changes.
- Publish claims without source review.
- Infer secret ownership from writing patterns.
- Determine creator intent.
- Accuse companies of manipulation.
- Label organizations as private equity without verified evidence.
- Generate fake citations.
- Treat model confidence as factual confidence.

## 21.3 Structured LLM Output

```json
{
  "candidate_claims": [
    {
      "subject": "Example Media",
      "predicate": "ACQUIRED",
      "object": "Example Channel",
      "effective_date": "2025-03-12",
      "supporting_text": "Example Media announced the acquisition...",
      "confidence": 0.82
    }
  ],
  "entities": [
    {
      "name": "Example Media",
      "type": "COMPANY"
    }
  ],
  "requires_human_review": true
}
```

## 21.4 Deterministic Validation

Validate LLM output against:

- Known schema.
- Source text.
- Entity registry.
- Date format.
- Relationship vocabulary.
- URL allowlist.
- Quotation verification.

---

# 22. Privacy, Security, and Ethics

## 22.1 Privacy Principles

The extension should not collect:

- Full browsing history.
- Video watch duration.
- Search queries.
- Comments.
- Google account identity.
- Subscription list.
- Personally identifying viewer information.

## 22.2 Anonymous Lookup Mode

The extension should send only:

```text
YouTube channel ID
Extension version
Requested data version
```

Avoid sending:

- Video ID unless required.
- User identity.
- Full page URL.
- Referrer.
- YouTube cookies.

## 22.3 Optional Telemetry

Telemetry must be:

- Disabled by default, or clearly opt-in.
- Aggregated.
- Documented.
- Easy to disable.
- Free of channel-viewing histories.

Permitted telemetry might include:

- Extension version.
- API latency.
- Rendering failures.
- Selector failures.
- Anonymous crash data.

## 22.4 Creator Safety

Do not publish:

- Home addresses.
- Personal phone numbers.
- Family information.
- Private email addresses.
- Confidential contracts.
- Leaked personal documents.
- Speculative personal wealth.
- Information unrelated to ownership transparency.

---

# 23. Legal and Defamation Risk

This project has meaningful legal exposure.

A false claim that a person or company secretly controls a channel could cause reputational or commercial harm.

## 23.1 Safer Language

Prefer:

> "Public records indicate that Company A acquired Channel B."

Avoid:

> "Channel B sold out to private equity."

Prefer:

> "The exact ownership percentage was not publicly disclosed."

Avoid:

> "The creator no longer has any control."

Prefer:

> "The creator remains publicly associated with the channel, but current ownership terms are not publicly available."

## 23.2 Separate Facts from Interpretation

Display:

```text
Verified Fact:
Company A announced an investment in Company B.

Unknown:
Whether Company A has editorial control.

Interpretation:
No conclusion is made about editorial influence.
```

## 23.3 Correction Policy

Corrections should:

- Be processed promptly.
- Preserve an audit trail.
- Identify what changed.
- Explain why it changed.
- Notify the submitter.
- Update cached extension results.
- Avoid silently rewriting controversial records.

## 23.4 Legal Review

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

---

# 24. Moderation and Appeals

## 24.1 Who May Appeal

- Channel owners.
- Creators.
- Company representatives.
- Investors.
- Employees.
- Researchers.
- Members of the public.

## 24.2 Appeal Requirements

An appeal should include:

- The challenged claim.
- Reason for the challenge.
- Supporting evidence.
- Relationship to the subject.
- Requested correction.

## 24.3 Appeal Outcomes

```text
UPHELD
PARTIALLY_UPHELD
CORRECTED
RETRACTED
MORE_EVIDENCE_REQUIRED
NO_ACTION
```

## 24.4 Public Dispute Notices

When credible disagreement exists:

```text
Ownership Disputed

The channel is listed as owned by Company A based on an acquisition
announcement. A representative of the creator states that the transaction
did not include the YouTube channel. The record is under review.
```

---

# 25. Repository Structure

> Superseded by `docs/plan.md` (TypeScript-only monorepo; reviewer console merged into
> `apps/web`; research-worker and source-archiver deferred). Original structure kept in
> the founding spec history for reference — see git history or the original brainstorm.

---

# 26. Component Specifications

## 26.1 Channel Resolver

Input:

```text
YouTube page DOM
Current URL
Structured page metadata
```

Output:

```json
{
  "youtube_channel_id": "UC123456",
  "handle": "@example",
  "display_name": "Example Channel",
  "resolution_method": "STRUCTURED_DATA",
  "confidence": 1.0
}
```

Requirements:

- Prefer channel IDs.
- Support YouTube single-page navigation.
- Avoid repeated API calls.
- Return no classification when identity is ambiguous.

## 26.2 Ownership Classifier

Input:

- Channel.
- Active relationships.
- Entity graph.
- Current date.
- Published claims.

Output:

```json
{
  "classification": "PE_BACKED",
  "direct_owner": "Example Media",
  "ultimate_parent": "Example Capital",
  "confidence": 0.93,
  "explanation_codes": [
    "DIRECT_OWNER_CONFIRMED",
    "OWNER_IS_PE_PORTFOLIO_COMPANY"
  ]
}
```

## 26.3 Evidence Scorer

Responsibilities:

- Score source quality.
- Detect duplicate sources.
- Penalize circular reporting.
- Penalize stale claims.
- Detect contradictions.
- Generate human-readable confidence explanations.

## 26.4 Source Archiver

Store:

- URL.
- Retrieval timestamp.
- Page title.
- Publisher.
- Content hash.
- Short relevant excerpt.
- Archive URL.
- HTTP status.
- Language.
- Source type.

## 26.5 Audit System

Every material change should record:

```text
Who changed it
What changed
When it changed
Why it changed
Which evidence supported the change
Whether the change was published
```

---

# 27. Development Roadmap

## Phase 0: Project Foundation

Deliverables:

- Finalize manifesto.
- Finalize evidence policy.
- Finalize legal language.
- Define ownership taxonomy.
- Define source hierarchy.
- Define correction process.
- Set up monorepo.
- Configure CI.
- Add code formatting and linting.
- Add security policy.

## Phase 1: Manual Dataset MVP

Goal:

Prove that the user interface and ownership model are useful before building automated research.

Deliverables:

- Manually research 100–250 channels.
- Create channel, entity, relationship, source, and claim tables.
- Build reviewer-only data entry interface.
- Build public lookup API.
- Build basic Chrome extension.
- Show ownership badge on channel and video pages.
- Show evidence panel.
- Add correction submission form.

Important decision:

Do not begin with machine learning.

The greatest early risk is not extraction accuracy. It is whether the ownership taxonomy, evidence standard, and user interface are understandable and defensible.

## Phase 2: Research Workflow

Deliverables:

- Research queue.
- Source submission system.
- Entity resolution interface.
- Claim review workflow.
- Audit history.
- Source archive support.
- Two-person approval for sensitive claims.
- Public methodology page.

## Phase 3: Broader YouTube Coverage

Deliverables:

- Search-page badges.
- Homepage badges.
- Subscription-feed badges.
- Shorts support.
- Playlist support.
- Local caching.
- Firefox build.
- Extension settings.

## Phase 4: Automated Discovery

Deliverables:

- Corporate press-release monitor.
- Portfolio-page monitor.
- News candidate collector.
- Channel website scanner.
- Historical-page comparison.
- Automated draft claim extraction.
- Human review requirement.

## Phase 5: Ownership Graph

Deliverables:

- Multi-level parent tracing.
- Private equity portfolio mapping.
- Historical ownership timeline.
- Creator involvement modeling.
- Minority versus controlling investment distinction.
- Relationship visualization.

## Phase 6: Community Research

Deliverables:

- Verified researcher accounts.
- Source contribution workflow.
- Reputation system based on accepted evidence.
- Moderation controls.
- Abuse prevention.
- Public research notes.
- Claim discussion pages.

## Phase 7: Public Data Platform

Deliverables:

- Public dataset export.
- Versioned releases.
- Research API.
- Bulk lookup.
- Academic documentation.
- Data provenance.
- Historical snapshots.

## Phase 8: Sustainable Governance

Deliverables:

- Nonprofit or public-benefit governance evaluation.
- Independent review board.
- Conflict-of-interest policy.
- Funding transparency.
- Annual methodology review.
- Public correction statistics.
- Public accuracy report.

---

# 28. Testing Strategy

## 28.1 Unit Tests

Test:

- Channel ID extraction.
- Handle resolution.
- Confidence scoring.
- Entity matching.
- Ownership graph traversal.
- Ultimate-parent detection.
- Classification generation.
- Cache expiration.
- Evidence status handling.
- Dispute handling.

## 28.2 Integration Tests

Test:

- Extension-to-API requests.
- API-to-database queries.
- Research worker claim creation.
- Reviewer approval.
- Correction publication.
- Cache invalidation.
- Source archival.

## 28.3 End-to-End Tests

Scenarios:

```text
Creator-owned channel
Corporate-owned channel
PE-backed portfolio company
Minority investment only
Creator-managed but not acquired
Ownership disputed
Channel handle changed
Channel renamed
No available ownership data
Outdated acquisition record
Company sold to another owner
```

## 28.4 Selector Health Tests

Regularly test the extension against representative YouTube page snapshots.

Alert when:

- Channel ID cannot be resolved.
- Badge insertion point disappears.
- YouTube markup changes.
- Duplicate badges appear.
- Badge blocks native controls.
- SPA navigation fails.

## 28.5 Research Quality Tests

Maintain a gold-standard dataset reviewed by humans.

Measure:

- Entity-match precision.
- Relationship-extraction precision.
- False positive rate.
- False negative rate.
- Source credibility classification.
- Ownership-status accuracy.
- Ultimate-parent accuracy.
- Private-equity classification accuracy.

For ownership accusations, precision matters more than recall.

A missed acquisition is preferable to a false accusation.

---

# 29. Deployment Plan

## 29.1 Development

Use Docker Compose:

```text
API
PostgreSQL
Web App (public site + reviewer console)
```

## 29.2 Production

Initial deployment can use:

- Managed PostgreSQL.
- Container hosting.
- CDN.
- Error monitoring.
- Automated backups.

Kubernetes is unnecessary for the MVP.

## 29.3 Observability

Track:

- API latency.
- API error rate.
- Cache hit rate.
- Extension version usage.
- Selector failures.
- Research queue depth.
- Review time.
- Correction volume.
- Published claim count.
- Disputed claim count.
- Source link failures.

---

# 30. Open-Source Governance

The project should publish:

- Funding sources.
- Major donors.
- Sponsorships.
- Maintainer conflicts of interest.
- Data partnerships.
- Government requests.
- Takedown requests.
- Correction statistics.
- Methodology changes.

## 30.1 Governance Roles

```text
Maintainers
Researchers
Reviewers
Moderators
Security Team
Appeals Reviewers
Community Contributors
Advisory Board
```

## 30.2 Conflict-of-Interest Rules

A reviewer should not approve claims involving:

- Their employer.
- Their investment holdings.
- Their clients.
- A company funding the project.
- A creator with whom they have a personal dispute.
- A company they are actively investigating elsewhere.

---

# 31. Contribution Model

Contributions may include:

- Code.
- Documentation.
- Sources.
- Corrections.
- Entity aliases.
- Translation.
- Accessibility improvements.
- Selector fixes.
- Research methodology.
- Legal review.
- Security testing.

Research contributions should not be merged like ordinary code.

They require:

- Source verification.
- Entity verification.
- Reviewer approval.
- Neutral wording.
- Audit logging.

---

# 32. Threat Model

## 32.1 False Submissions

Attackers may submit fabricated evidence against creators.

Controls:

- Source validation.
- Reviewer approval.
- Submission rate limits.
- Contributor reputation.
- Duplicate detection.
- Two-person review.

## 32.2 Corporate Manipulation

Owners may attempt to remove accurate records or submit misleading ownership structures.

Controls:

- Evidence-based appeals.
- Public correction trail.
- Multiple independent sources.
- Conflict disclosure.
- No paid record removal.

## 32.3 Activist Capture

Contributors may try to use the platform to punish politically disfavored channels.

Controls:

- Ownership-only scope.
- No ideological scoring.
- Neutral taxonomy.
- Source hierarchy.
- Reviewer diversity.
- Auditable decisions.

## 32.4 Data Poisoning

Attackers may create fake press releases, domains, or documents.

Controls:

- Domain age checks.
- Publisher validation.
- Official registry verification.
- Content hashing.
- Archive checks.
- Cross-source corroboration.

## 32.5 Extension Compromise

A compromised extension could observe users or inject malicious code.

Controls:

- Minimal permissions.
- Strict content security policy.
- Reproducible builds.
- Signed releases.
- Dependency scanning.
- No remotely executed code.
- Public source code.
- Security audits.

## 32.6 API Enumeration

Bulk users may scrape the entire dataset.

This may be acceptable if the dataset is intended to be public.

Protect operational systems through:

- Rate limits.
- Separate public data dumps.
- API keys for bulk access.
- Read replicas.
- Abuse monitoring.

---

# 33. Success Metrics

## 33.1 Product Metrics

- Number of researched channels.
- Number of verified ownership relationships.
- Extension installations.
- Weekly active extension users.
- Badge render success rate.
- API uptime.
- Evidence-panel usage.

## 33.2 Research Metrics

- Percentage of claims with Tier 1 sources.
- Average sources per claim.
- Median time to review.
- Median time to process corrections.
- Percentage of records reviewed within the last year.
- Dispute rate.
- Retraction rate.
- False-positive rate.

## 33.3 Trust Metrics

- Percentage of classifications with visible reasoning.
- Percentage of corrections publicly documented.
- Creator response satisfaction.
- Independent audit results.
- Percentage of funding publicly disclosed.
- Number of substantiated complaints.

The project should not optimize for the number of channels labeled PE-backed.

That would create pressure to over-classify.

---

# 34. Future Features

Possible future additions:

- Ownership indicators for TikTok.
- Ownership indicators for Instagram.
- Podcast ownership tracking.
- Newsletter ownership tracking.
- Media conglomerate maps.
- Acquisition alerts.
- Creator departure alerts.
- Public corporate family trees.
- Sponsorship concentration analysis.
- Channel-network visualization.
- Content licensing disclosures.
- AI-generated-content disclosures.
- Labor and production-company disclosures.
- User-created watchlists.
- Researcher data exports.
- Historical channel branding comparisons.
- Public acquisition timeline.
- Browser-independent website.
- Mobile share-sheet lookup.

These should be separate modules rather than expanding the initial badge into an all-purpose reputation score.

---

# 35. Example Channel Record

```yaml
channel:
  youtube_channel_id: UC123456789
  display_name: Example Channel
  handle: "@examplechannel"
  classification: PE_BACKED
  confidence: 0.93
  confidence_label: CONFIRMED
  last_reviewed_at: 2026-07-18

direct_owner:
  name: Example Media LLC
  entity_type: COMPANY
  relationship: OWNS
  effective_from: 2025-03-12
  ownership_percentage: null
  control_level: CONTROLLING

ultimate_parent:
  name: Example Capital Partners
  entity_type: PRIVATE_EQUITY_FIRM
  relationship: PORTFOLIO_COMPANY_OF

creator:
  name: Original Creator
  current_role: HOST
  ownership_status: UNKNOWN
  operational_control: UNKNOWN

summary:
  short: >
    Example Channel is owned by Example Media LLC. Example Media is a
    portfolio company of Example Capital Partners.

  limitation: >
    Public sources do not disclose the original creator's current equity
    ownership or editorial authority.

evidence:
  - type: OFFICIAL_ACQUISITION_ANNOUNCEMENT
    title: Example Media Acquires Example Channel
    published_at: 2025-03-12
    source_tier: 1
    status: ACTIVE

  - type: INVESTOR_PORTFOLIO_PAGE
    title: Example Media Portfolio Listing
    published_at: null
    source_tier: 1
    status: ACTIVE

  - type: TRADE_PUBLICATION
    title: Example Media Expands Creator Portfolio
    published_at: 2025-03-13
    source_tier: 2
    status: ACTIVE

history:
  - date: 2017-06-04
    event: CHANNEL_CREATED

  - date: 2025-03-12
    event: ACQUISITION_ANNOUNCED

  - date: 2025-04-01
    event: ACQUISITION_COMPLETED
```

---

# 36. Example User Interface

## Compact Badge

```text
Example Channel  [PE-Backed]
```

## Expanded Panel

```text
┌─────────────────────────────────────────────┐
│ CHANNELWATCH                                │
├─────────────────────────────────────────────┤
│ Example Channel                             │
│                                             │
│ Status                                      │
│ Private-equity-backed                       │
│                                             │
│ Direct owner                                │
│ Example Media LLC                           │
│                                             │
│ Ultimate parent                             │
│ Example Capital Partners                    │
│                                             │
│ Creator involvement                         │
│ Original creator remains the public host.   │
│ Current ownership stake is not disclosed.   │
│                                             │
│ Ownership changed                           │
│ March 2025                                  │
│                                             │
│ Confidence                                  │
│ Confirmed                                   │
│                                             │
│ Evidence                                    │
│ • Official acquisition announcement         │
│ • Investor portfolio listing                │
│ • Industry publication                      │
│                                             │
│ No conclusion is made about editorial       │
│ interference.                               │
│                                             │
│ [View Full Record]  [Report an Error]        │
└─────────────────────────────────────────────┘
```

---

# 37. Initial MVP Scope

The MVP should remain deliberately narrow.

## 37.1 MVP Features

Build:

1. Chrome extension.
2. Channel ID extraction.
3. Badge on video and channel pages.
4. Public lookup API.
5. Manually curated dataset.
6. Ownership evidence panel.
7. Direct owner field.
8. Ultimate parent field.
9. PE-backed classification.
10. Confidence label.
11. Source links.
12. Last-reviewed date.
13. Correction form.
14. Internal reviewer interface.
15. Complete audit log.

## 37.2 Do Not Build in the MVP

Do not initially build:

- Fully automated ownership classification.
- Behavioral content analysis.
- Political-bias detection.
- Sponsorship tracking.
- Multi-platform support.
- User accounts.
- Social features.
- Public comments.
- Contributor reputation.
- Graph database.
- Kubernetes infrastructure.
- Real-time global web crawling.
- A universal channel trust score.

## 37.3 Initial Dataset

Start with approximately 100 carefully selected channels across:

- Creator-owned channels.
- Known media-company acquisitions.
- PE-backed media portfolios.
- Multi-channel networks.
- Channels with minority investments.
- Channels with public creator exits.
- Channels with disputed ownership.
- Corporate-native channels.

The dataset should be balanced.

Do not select only controversial acquisitions.

---

# 38. Recommended Technology Stack

> Superseded by `docs/plan.md`: TypeScript-only. Extension: TS + React + Vite + MV3.
> Web: Next.js. API: Hono + Drizzle + Zod + PostgreSQL (replaces Python/FastAPI).
> Redis/queues/object storage/OpenSearch/Neo4j deferred until scale demands them.

---

# 39. Project Naming

Chosen name: **CHANNELWATCH** — "Know who is behind the channel."

(Alternatives considered: Channel Ledger, WhoOwnsTube, CreatorTrace, ChannelScope,
Ownership Lens, ParentChannel, Channel Provenance.)

---

# 40. Final Design Principles

1. **Never confuse investment with ownership.**
2. **Never confuse ownership with editorial control.**
3. **Never present suspicion as fact.**
4. **Every published claim must show evidence.**
5. **Every classification must express uncertainty.**
6. **Every record must have a review date.**
7. **Every correction must leave an audit trail.**
8. **The extension must not monitor viewers.**
9. **The system must use immutable channel IDs.**
10. **Automation may generate leads, not verdicts.**
11. **Precision is more important than coverage.**
12. **Neutral descriptions are more useful than inflammatory labels.**
13. **The project must disclose its own funding and conflicts.**
14. **Creators and companies must have a meaningful right of reply.**
15. **The project should explain ownership, not tell users what to believe.**

---

# Recommended First Build Order

```text
1. Finalize METHODOLOGY.md
2. Finalize ownership and relationship taxonomy
3. Create PostgreSQL schema
4. Build manual reviewer data-entry workflow
5. Research 25 test channels
6. Build channel lookup API
7. Build channel ID resolver
8. Add badge to YouTube channel pages
9. Add badge to video pages
10. Build evidence drawer
11. Add correction workflow
12. Expand dataset to 100 channels
13. Publish public methodology and audit history
14. Add automated source discovery
15. Add private equity ownership graph traversal
```

The most important product decision is to launch CHANNELWATCH first as a **transparent, manually verified ownership database with a browser interface**, not as an AI system that attempts to guess whether creators were secretly acquired.

The automation should come later, after the project has proven that its definitions, evidence standards, dispute handling, and public language are reliable.
