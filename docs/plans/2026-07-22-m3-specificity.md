# M3 Batch 1 — Classification Specificity & Ownership Chain Display

User-directed policy resolution (2026-07-22): identify corporations by name when not
creator-controlled; majority stakes/partial ownership must show mechanism + percentage
where sourced; UNCLEAR only when genuinely unclear; panels show the full ownership chain
(e.g. Little Baby Bum → Moonbug → Candle Media → Blackstone). Branch: `m3-specificity`.

## Global Constraints

- All M0–M2 conventions. Copy module only for user-facing strings; badge colors via schemas map; precision-over-recall still governs — these rules widen what counts as *documented* ownership, they never invent it. Neutral mechanism words ("acquired", "majority investment", "controlling stake") from sourced relationship data only.
- Legal-safe: naming an owner is only ever done from ACTIVE reviewed relationships; percentage shown only when `ownership_percentage` is non-null; otherwise "stake not publicly disclosed" copy.

## Task 1: Graph + schemas — ownership rules v2 (TDD)

In `packages/graph` + `@channelwatch/schemas`:

1. **Owner-edge widening:** direct-owner candidate edges are now OWNS, ACQUIRED, CONTROLS, plus PARTIALLY_OWNS or INVESTED_IN when (`control_level === "CONTROLLING"` OR `ownership_percentage > 50`). Precedence: OWNS > ACQUIRED > CONTROLS > PARTIALLY_OWNS > INVESTED_IN. Explanation code `MAJORITY_STAKE_OWNER` when the qualifying edge is PARTIALLY_OWNS/INVESTED_IN.
2. **Creator-controlled company:** if the direct owner is a COMPANY (or NONPROFIT/BRAND) that is itself controlled by a CREATOR/PERSON — via CONTROLS, OWNS, or PARTIALLY_OWNS with CONTROLLING or >50% — classify `CREATOR_OWNED` with code `CREATOR_CONTROLLED_COMPANY`; keep the company as directOwner (the panel names it). This replaces the narrower FOUNDED_BY+PARTIALLY_OWNS rule (keep that as an additional qualifying path).
3. **Nonprofit owner:** direct owner entity_type NONPROFIT (and not creator-controlled) → new classification label `NONPROFIT_OWNED` (add to schemas ClassificationLabel; badge label "Nonprofit-Owned"; badge color PURPLE; copy summary template). Update the never-emitted documentation list.
4. **Ownership chain output:** `deriveClassification` result gains `chain: Array<{entityId, name?, entityType, relationshipType, ownershipPercentage: number|null, controlLevel, effectiveFrom: string|null, confidence}>` ordered channel-owner upward (it already returns a chain — extend each step with mechanism fields; resolve entity names from the entities input).
5. TDD: Veritasium-shaped fixture (majority PARTIALLY_OWNS by INVESTMENT_FIRM) → owner = firm, NOT unclear (label CORPORATE_OWNED unless PE in chain); TLDR-shaped (company owner + person CONTROLS/75% company) → CREATOR_OWNED + code; vlogbrothers-shaped (NONPROFIT owner, creators not controlling) → NONPROFIT_OWNED; minority-only INVESTED_IN still NOT ownership (stays EXTERNALLY_FUNDED/UNCLEAR as before); LBB chain steps carry relationship type + percentage null + control levels; precedence and >50% boundary tests (50 exactly → not owner; 50.1 → owner).

Verify: all suites green; re-import all 12 records against local DB and record the classification table in the report — expected flips: veritasium UNCLEAR→CORPORATE_OWNED (or PE_BACKED if Capital D edges qualify via shared entity graph — report what happens), tldr-news CORPORATE_OWNED→CREATOR_OWNED, vlogbrothers UNCLEAR→NONPROFIT_OWNED; smosh/breaking-points/LBB unchanged; mrbeast/dude-perfect/fern/daily-wire remain UNCLEAR (genuinely undocumented channel ownership). Commit.

## Task 2: API + extension — chain and mechanism display

1. **API:** extend `ChannelLookupResponse` (schemas) with `ownership_chain: Array<{name, type, relationship, ownership_percentage: number|null, control_level, effective_from: string|null}>` and `direct_owner.mechanism` fields; assemble from the graph chain; keep §17.2 fields untouched (additive only). Summary template updated to name the owner and mechanism (copy module; e.g. "Owned by Moonbug Entertainment, a Candle Media company backed by Blackstone." built from templates, no free prose).
2. **Panel:** render the chain as an ordered list with mechanism + percentage-or-"not disclosed" per hop, and dates when present. Badge text for non-creator labels appends the operative entity name from copy templates: PE_BACKED → ultimate PE firm name ("PE-Backed · Blackstone"); CORPORATE_OWNED/NONPROFIT_OWNED → direct owner name. Truncate names >24 chars with ellipsis + full name in panel. Settings unaffected.
3. Tests: API integration (LBB lookup carries 3-hop chain with names Moonbug/Candle/Blackstone), panel chain rendering, badge-name rendering per label, copy tests for new templates incl. banned-language sweep.

Verify: all suites green both modes; curl LBB lookup shows the chain; extension build loadable. Commit.
