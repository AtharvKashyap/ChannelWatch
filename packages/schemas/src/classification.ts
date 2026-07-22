import type { BadgeColor, ClassificationLabel } from "./enums.js";

/**
 * Maps a classification label to its badge color per SPEC §9.2.
 *
 * Semantic categories (§9.2):
 * - Neutral: ownership unknown / not researched / change in progress.
 * - Green:   creator-owned or independently controlled.
 * - Blue:    externally funded or managed.
 * - Purple:  corporate-owned.
 * - Orange:  private-equity-backed.
 * - Red:     disputed or materially misleading public ownership information.
 *
 * SPEC §9.2 is explicit: "Red should not mean 'private equity.'" PE_BACKED
 * therefore maps to ORANGE, and RED is reserved solely for DISPUTED.
 */
const CLASSIFICATION_TO_BADGE_COLOR: Record<ClassificationLabel, BadgeColor> = {
  INDEPENDENT: "GREEN",
  CREATOR_OWNED: "GREEN",
  EXTERNALLY_FUNDED: "BLUE",
  CORPORATE_OWNED: "PURPLE",
  PE_BACKED: "ORANGE",
  OWNERSHIP_CHANGED: "NEUTRAL",
  OWNERSHIP_UNCLEAR: "NEUTRAL",
  DISPUTED: "RED",
};

export function classificationToBadgeColor(label: ClassificationLabel): BadgeColor {
  return CLASSIFICATION_TO_BADGE_COLOR[label];
}
