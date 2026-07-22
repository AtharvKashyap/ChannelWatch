import type { SourceType, SourceTier } from "@channelwatch/schemas";

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

/**
 * Maps each SourceType to its SourceTier (§7.1), grouped by the §14.1
 * ordering: filings through registry records are Tier 1 (primary/direct),
 * publications and named interviews are Tier 2, archived pages through
 * technical infrastructure linkage are Tier 3, and tips/behavioral signals
 * are Tier 4 (leads only).
 */
export const SOURCE_TYPE_TIERS: Record<SourceType, SourceTier> = {
  OFFICIAL_REGULATORY_FILING: 1,
  OFFICIAL_ACQUISITION_ANNOUNCEMENT: 1,
  INVESTOR_PORTFOLIO_LISTING: 1,
  DIRECT_CREATOR_CONFIRMATION: 1,
  CORPORATE_REGISTRY_RECORD: 1,
  REPUTABLE_BUSINESS_PUBLICATION: 2,
  ESTABLISHED_INDUSTRY_PUBLICATION: 2,
  NAMED_EXECUTIVE_INTERVIEW: 2,
  ARCHIVED_CORPORATE_PAGE: 3,
  TRADEMARK_TRANSFER: 3,
  SHARED_LEGAL_DOCUMENTATION: 3,
  TECHNICAL_INFRASTRUCTURE_LINKAGE: 3,
  ANONYMOUS_TIP: 4,
  BEHAVIORAL_CONTENT_CHANGE: 4,
};
