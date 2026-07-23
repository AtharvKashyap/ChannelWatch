import {
  badgeAriaLabel,
  badgeText,
  classificationToBadgeColor,
  type BadgeColor,
  type ClassificationLabel,
} from "@channelwatch/schemas";
import { BADGE_PALETTE } from "./badge-colors.js";

/**
 * The ownership badge chip (SPEC §9.1). Every user-facing string comes from the
 * reviewed copy module (CLAUDE.md rule 2):
 *   - the label + optional operative entity name from `badgeText` (which reads
 *     `BADGE_LABELS` and applies the name-suffix rules — PE_BACKED /
 *     CORPORATE_OWNED / NONPROFIT_OWNED name their entity, truncated to the chip
 *     width; every other label carries no name);
 *   - the accessible label from `badgeAriaLabel` (announces the full name);
 * and the color from `classificationToBadgeColor` (the §9.2 single source of
 * truth — never trust a color off the wire; RED is reserved for DISPUTED, never
 * private equity). `name` is the operative entity name (direct owner / ultimate
 * PE firm) already resolved by the caller; omit it when none applies.
 */
export interface BadgeProps {
  label: ClassificationLabel;
  name?: string | null;
}

export function Badge({ label, name }: BadgeProps) {
  const color: BadgeColor = classificationToBadgeColor(label);
  const { bg, fg } = BADGE_PALETTE[color];
  return (
    <span
      className="cw-badge"
      data-cw-color={color}
      aria-label={badgeAriaLabel(label, name)}
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 600,
        lineHeight: 1.5,
        backgroundColor: bg,
        color: fg,
      }}
    >
      {badgeText(label, name)}
    </span>
  );
}
