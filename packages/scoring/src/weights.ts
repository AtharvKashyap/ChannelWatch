import type { SourceType } from "@channelwatch/schemas";

/**
 * Re-exported from `@channelwatch/schemas`: the SourceType→SourceTier map is
 * pure taxonomy and now lives with the enums (single source of truth). Kept as a
 * scoring export so existing importers of `@channelwatch/scoring` are unaffected.
 */
export { SOURCE_TYPE_TIERS } from "@channelwatch/schemas";

/**
 * Suggested evidence weights per SPEC §14.1, keyed by SourceType. Verbatim
 * from the SPEC table — weights should not simply be added; see
 * `scoreClaimConfidence` (§14.2) for how they combine with other factors.
 */
export const EVIDENCE_WEIGHTS: Record<SourceType, number> = {
  OFFICIAL_REGULATORY_FILING: 1.0,
  OFFICIAL_ACQUISITION_ANNOUNCEMENT: 0.95,
  INVESTOR_PORTFOLIO_LISTING: 0.9,
  DIRECT_CREATOR_CONFIRMATION: 0.9,
  CORPORATE_REGISTRY_RECORD: 0.9,
  REPUTABLE_BUSINESS_PUBLICATION: 0.8,
  ESTABLISHED_INDUSTRY_PUBLICATION: 0.75,
  NAMED_EXECUTIVE_INTERVIEW: 0.75,
  ARCHIVED_CORPORATE_PAGE: 0.65,
  TRADEMARK_TRANSFER: 0.65,
  SHARED_LEGAL_DOCUMENTATION: 0.6,
  TECHNICAL_INFRASTRUCTURE_LINKAGE: 0.35,
  ANONYMOUS_TIP: 0.1,
  BEHAVIORAL_CONTENT_CHANGE: 0.05,
};
