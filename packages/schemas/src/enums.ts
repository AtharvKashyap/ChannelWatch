import { z } from "zod";

/**
 * Enumerations for CHANNELWATCH, mirroring docs/SPEC.md exactly.
 *
 * Each enum is defined once as a readonly `as const` array (the single source
 * of truth), then re-derived into a string-literal union type and a Zod enum.
 * Enum member values MUST match the SPEC lists verbatim — no renames, no
 * invented members.
 */

// §15.1 Node Types (14 values). CHANNEL/CREATOR are node types kept alongside
// the other entity kinds.
export const ENTITY_TYPES = [
  "CHANNEL",
  "CREATOR",
  "PERSON",
  "COMPANY",
  "SUBSIDIARY",
  "MEDIA_NETWORK",
  "INVESTMENT_FIRM",
  "PRIVATE_EQUITY_FIRM",
  "VENTURE_CAPITAL_FIRM",
  "FUND",
  "BRAND",
  "TRUST",
  "NONPROFIT",
  "UNKNOWN_ENTITY",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];
export const EntityTypeSchema = z.enum(ENTITY_TYPES);

// §15.2 Relationship Types (20 values).
export const RELATIONSHIP_TYPES = [
  "OWNS",
  "PARTIALLY_OWNS",
  "CONTROLS",
  "OPERATES",
  "MANAGES",
  "FUNDS",
  "INVESTED_IN",
  "ACQUIRED",
  "MERGED_WITH",
  "LICENSES_FROM",
  "REPRESENTS",
  "FOUNDED_BY",
  "HOSTED_BY",
  "EMPLOYS",
  "SUBSIDIARY_OF",
  "PORTFOLIO_COMPANY_OF",
  "CREATIVE_CONTROL_BY",
  "DISTRIBUTED_BY",
  "AD_SALES_BY",
  "FORMERLY_OWNED_BY",
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];
export const RelationshipTypeSchema = z.enum(RELATIONSHIP_TYPES);

// §8.2 Evidence Status.
export const EVIDENCE_STATUSES = [
  "ACTIVE",
  "SUPERSEDED",
  "RETRACTED",
  "DISPUTED",
  "ARCHIVED",
  "BROKEN_LINK",
  "PENDING_REVIEW",
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];
export const EvidenceStatusSchema = z.enum(EVIDENCE_STATUSES);

// §8.3 Claim Status.
export const CLAIM_STATUSES = [
  "DRAFT",
  "UNDER_REVIEW",
  "PUBLISHED",
  "DISPUTED",
  "CORRECTED",
  "RETRACTED",
  "ARCHIVED",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];
export const ClaimStatusSchema = z.enum(CLAIM_STATUSES);

// §8.1 Confidence Levels.
export const CONFIDENCE_LABELS = [
  "CONFIRMED",
  "HIGH",
  "MODERATE",
  "LOW",
  "DISPUTED",
  "UNKNOWN",
] as const;
export type ConfidenceLabel = (typeof CONFIDENCE_LABELS)[number];
export const ConfidenceLabelSchema = z.enum(CONFIDENCE_LABELS);

// §9.1 Extension Badge labels, mapped to stable codes.
export const CLASSIFICATION_LABELS = [
  "INDEPENDENT",
  "CREATOR_OWNED",
  "EXTERNALLY_FUNDED",
  "CORPORATE_OWNED",
  "PE_BACKED",
  "OWNERSHIP_CHANGED",
  "OWNERSHIP_UNCLEAR",
  "DISPUTED",
] as const;
export type ClassificationLabel = (typeof CLASSIFICATION_LABELS)[number];
export const ClassificationLabelSchema = z.enum(CLASSIFICATION_LABELS);

// §9.2 Badge Colors.
export const BADGE_COLORS = ["NEUTRAL", "GREEN", "BLUE", "PURPLE", "ORANGE", "RED"] as const;
export type BadgeColor = (typeof BADGE_COLORS)[number];
export const BadgeColorSchema = z.enum(BADGE_COLORS);

// §7.1 Source tiers (Tier 1 primary … Tier 4 leads only).
export const SOURCE_TIERS = [1, 2, 3, 4] as const;
export type SourceTier = (typeof SOURCE_TIERS)[number];
export const SourceTierSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

// §14.1 Evidence source types (14 values), ordered by descending suggested
// weight. Backs the `EVIDENCE_WEIGHTS` record in @channelwatch/scoring.
export const SOURCE_TYPES = [
  "OFFICIAL_REGULATORY_FILING",
  "OFFICIAL_ACQUISITION_ANNOUNCEMENT",
  "INVESTOR_PORTFOLIO_LISTING",
  "DIRECT_CREATOR_CONFIRMATION",
  "CORPORATE_REGISTRY_RECORD",
  "REPUTABLE_BUSINESS_PUBLICATION",
  "ESTABLISHED_INDUSTRY_PUBLICATION",
  "NAMED_EXECUTIVE_INTERVIEW",
  "ARCHIVED_CORPORATE_PAGE",
  "TRADEMARK_TRANSFER",
  "SHARED_LEGAL_DOCUMENTATION",
  "TECHNICAL_INFRASTRUCTURE_LINKAGE",
  "ANONYMOUS_TIP",
  "BEHAVIORAL_CONTENT_CHANGE",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
export const SourceTypeSchema = z.enum(SOURCE_TYPES);

// §20.1 Research Queue States (10 values).
export const RESEARCH_STATUSES = [
  "UNRESEARCHED",
  "DISCOVERY_RUNNING",
  "CANDIDATES_FOUND",
  "NEEDS_REVIEW",
  "RESEARCH_INCOMPLETE",
  "APPROVED",
  "PUBLISHED",
  "DISPUTED",
  "RECHECK_REQUIRED",
  "ARCHIVED",
] as const;
export type ResearchStatus = (typeof RESEARCH_STATUSES)[number];
export const ResearchStatusSchema = z.enum(RESEARCH_STATUSES);

// §15.3 control_level values.
export const CONTROL_LEVELS = [
  "CONTROLLING",
  "MINORITY",
  "MANAGEMENT",
  "LICENSE",
  "UNKNOWN",
] as const;
export type ControlLevel = (typeof CONTROL_LEVELS)[number];
export const ControlLevelSchema = z.enum(CONTROL_LEVELS);

// §6.5 Creator Involvement states, mapped to stable codes.
export const CREATOR_STATUSES = [
  "OWNER_OPERATOR",
  "OWNER_EXTERNAL_MGMT",
  "MAJORITY_OWNER",
  "MINORITY_OWNER",
  "HOST_NOT_IN_CONTROL",
  "REMAINS_HOST",
  "EXITED",
  "UNCLEAR",
  "CORPORATE_BRAND",
] as const;
export type CreatorStatus = (typeof CREATOR_STATUSES)[number];
export const CreatorStatusSchema = z.enum(CREATOR_STATUSES);
