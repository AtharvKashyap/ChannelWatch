import {
  CHAIN_COPY,
  ownershipMechanismText,
  ownershipStakeText,
  type OwnershipHistoryEntry,
} from "@channelwatch/schemas";

/**
 * The "Ownership over time" section (SPEC Track A temporal ownership history).
 * Presents the SAME `ownership_history` data as the extension panel
 * (`apps/extension/src/content/ownership-panel.tsx`) with the SAME legal-safe
 * phrasing — richer layout allowed. Periods are rendered in the order given
 * (the API returns them newest-first); the current period is marked, prior
 * periods are marked "previously", and each period shows its documented date
 * range or the honest `dateUndisclosed` fallback (dates are never inferred,
 * §23.1). Every user-facing string comes from the reviewed copy module
 * (CLAUDE.md rule 2).
 */
export interface OwnershipHistoryProps {
  entries: OwnershipHistoryEntry[];
}

export function OwnershipHistory({ entries }: OwnershipHistoryProps) {
  if (entries.length === 0) return null;
  return (
    <section className="cw-history" aria-label={CHAIN_COPY.historyHeading}>
      <h2>{CHAIN_COPY.historyHeading}</h2>
      <ol className="cw-history__list">
        {entries.map((entry, i) => (
          <HistoryPeriod key={`${entry.name}-${i}`} entry={entry} />
        ))}
      </ol>
    </section>
  );
}

function HistoryPeriod({ entry }: { entry: OwnershipHistoryEntry }) {
  const mechanism = ownershipMechanismText(entry.relationship, entry.control_level);
  const stake = ownershipStakeText(entry.ownership_percentage);
  const marker = entry.is_current ? CHAIN_COPY.currentLabel : CHAIN_COPY.previouslyPrefix;
  return (
    <li className="cw-history__period" data-cw-current={entry.is_current}>
      <span className="cw-history__name">{entry.name}</span>
      <span className="cw-history__marker">{marker}</span>
      <span className="cw-history__meta">
        {mechanism} · {stake} · {dateRangeText(entry)}
      </span>
    </li>
  );
}

/**
 * Neutral date-range text for one ownership period, identical in behavior to the
 * extension panel's helper. Both dates undocumented → the honest
 * `dateUndisclosed`. Otherwise a from–to range joined by `dateRangeSeparator`,
 * where an open-ended current period reads "… – current" and an undocumented
 * endpoint falls back to `dateUndisclosed`. Dates are never inferred (§23.1).
 */
export function dateRangeText(entry: OwnershipHistoryEntry): string {
  if (entry.effective_from === null && entry.effective_to === null) {
    return CHAIN_COPY.dateUndisclosed;
  }
  const from = entry.effective_from ?? CHAIN_COPY.dateUndisclosed;
  const to = entry.effective_to ?? (entry.is_current ? CHAIN_COPY.currentLabel : null);
  return to === null ? from : `${from} ${CHAIN_COPY.dateRangeSeparator} ${to}`;
}
