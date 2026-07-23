import {
  CONFIDENCE_LABEL_TEXT,
  type ConfidenceLabel as ConfidenceLabelType,
} from "@channelwatch/schemas";

/**
 * Displays the human-readable confidence band for a classification. The text
 * comes from `CONFIDENCE_LABEL_TEXT` in the reviewed copy module (CLAUDE.md
 * rule 2), which mirrors the §14.3 bands — this component defines no threshold
 * and no prose of its own. DISPUTED / UNKNOWN are conflict/absence states, not
 * score bands, and are rendered with their reviewed wording too.
 */
export interface ConfidenceLabelProps {
  value: ConfidenceLabelType;
}

export function ConfidenceLabel({ value }: ConfidenceLabelProps) {
  return (
    <span className="cw-confidence" data-cw-confidence={value}>
      {CONFIDENCE_LABEL_TEXT[value]}
    </span>
  );
}
