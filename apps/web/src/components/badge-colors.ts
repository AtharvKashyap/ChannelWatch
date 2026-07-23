import type { BadgeColor } from "@channelwatch/schemas";

/**
 * Accessible badge colors for the §9.2 semantic categories. Values mirror the
 * extension's shadow-root palette (`apps/extension/src/content/badge-renderer.ts`)
 * so a badge looks identical on the site and in the extension. All backgrounds
 * meet WCAG AA against white text.
 *
 * The color-to-meaning mapping itself is NOT defined here — it comes from
 * `classificationToBadgeColor` in `@channelwatch/schemas` (the single source of
 * truth). This map is display styling only.
 */
export const BADGE_PALETTE: Record<BadgeColor, { bg: string; fg: string }> = {
  NEUTRAL: { bg: "#5f6368", fg: "#ffffff" },
  GREEN: { bg: "#1e7e34", fg: "#ffffff" },
  BLUE: { bg: "#1565c0", fg: "#ffffff" },
  PURPLE: { bg: "#6a1b9a", fg: "#ffffff" },
  ORANGE: { bg: "#a85400", fg: "#ffffff" },
  RED: { bg: "#b71c1c", fg: "#ffffff" },
};
