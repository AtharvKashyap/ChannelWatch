import { SITE_COPY, UNRESEARCHED_SUMMARY, EDITORIAL_DISCLAIMER } from "@channelwatch/schemas";

/**
 * The neutral "not yet researched" state for a channel the platform has no
 * published claims for. Renders ONLY reviewed copy — the honest
 * `UNRESEARCHED_SUMMARY` plus the standing disclaimer. Fabricates nothing about
 * ownership (§8: precision over recall; CLAUDE.md rule 1).
 */
export function UnresearchedNotice() {
  return (
    <section className="cw-unresearched" aria-label={SITE_COPY.unresearchedHeading}>
      <h2>{SITE_COPY.unresearchedHeading}</h2>
      <p>{UNRESEARCHED_SUMMARY}</p>
      <p className="cw-unresearched__disclaimer">{EDITORIAL_DISCLAIMER}</p>
    </section>
  );
}
