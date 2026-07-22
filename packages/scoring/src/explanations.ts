import type { SourceType } from "@channelwatch/schemas";
import type { ConfidenceFactors } from "./confidence.js";

/**
 * Neutral, human-readable labels for each SourceType. Used only in fixed
 * templates below — never interpolated with free-text claim content.
 */
const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  OFFICIAL_REGULATORY_FILING: "an official regulatory filing",
  OFFICIAL_ACQUISITION_ANNOUNCEMENT: "an official acquisition announcement",
  INVESTOR_PORTFOLIO_LISTING: "an investor's official portfolio listing",
  DIRECT_CREATOR_CONFIRMATION: "a direct creator confirmation",
  CORPORATE_REGISTRY_RECORD: "a corporate registry record",
  REPUTABLE_BUSINESS_PUBLICATION: "a reputable business publication",
  ESTABLISHED_INDUSTRY_PUBLICATION: "an established industry publication",
  NAMED_EXECUTIVE_INTERVIEW: "a named executive interview",
  ARCHIVED_CORPORATE_PAGE: "an archived corporate page",
  TRADEMARK_TRANSFER: "a trademark transfer record",
  SHARED_LEGAL_DOCUMENTATION: "shared legal documentation",
  TECHNICAL_INFRASTRUCTURE_LINKAGE: "a technical infrastructure linkage",
  ANONYMOUS_TIP: "an anonymous tip",
  BEHAVIORAL_CONTENT_CHANGE: "an observed behavioral content change",
};

/** Threshold below which a factor is called out as notably weak in the explanation. */
const NOTABLY_LOW_THRESHOLD = 0.5;

/**
 * Builds a list of neutral, template-based explanation strings for a
 * confidence score's inputs (SPEC §14.2). Every string is drawn from a fixed
 * template describing the *factors and source type only* — never free-text
 * interpolation of the underlying claim itself.
 */
export function explainConfidence(factors: ConfidenceFactors, sourceType: SourceType): string[] {
  const lines: string[] = [];

  lines.push(`This claim is evidenced by ${SOURCE_TYPE_LABELS[sourceType]}.`);

  if (factors.directness < NOTABLY_LOW_THRESHOLD) {
    lines.push("The source implies ownership indirectly rather than stating it directly.");
  } else if (factors.directness >= 0.9) {
    lines.push("The source states ownership directly.");
  }

  if (factors.entityMatch < NOTABLY_LOW_THRESHOLD) {
    lines.push("The match between the source and the entity in question is weak.");
  }

  if (factors.recencyFactor < NOTABLY_LOW_THRESHOLD) {
    lines.push("This evidence is not recent and may be stale or outdated.");
  }

  if (factors.corroborationFactor < NOTABLY_LOW_THRESHOLD) {
    lines.push("This claim lacks independent corroborating sources.");
  } else if (factors.corroborationFactor >= 0.9) {
    lines.push("This claim is corroborated by independent sources.");
  }

  if (factors.contradictionPenalty < 1) {
    lines.push("There is contradicting evidence that lowers confidence in this claim.");
  }

  return lines;
}
