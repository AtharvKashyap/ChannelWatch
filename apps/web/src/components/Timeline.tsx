/**
 * A presentational ownership timeline: an ordered list of dated events. This
 * component is deliberately generic and display-only — it holds no fetching,
 * sorting, or ownership logic (those belong to the API / `packages/graph`). The
 * caller supplies already-ordered entries.
 *
 * There is no timeline event type in `@channelwatch/schemas` to reuse (the
 * `/timeline` endpoint assembles an ad-hoc shape in `services/api`), so this
 * defines a minimal PRESENTATIONAL prop contract rather than redefining that
 * response shape. When a shared schema type is added, callers can map onto it.
 */
export interface TimelineEntry {
  /** ISO date (or date-time) string; null when the event's date is unknown. */
  date: string | null;
  /** Short label for the event (e.g. a relationship or claim summary). */
  label: string;
  /** Optional secondary detail line. */
  detail?: string;
}

export interface TimelineProps {
  entries: TimelineEntry[];
  /** Text shown for an entry whose date is null. Defaults to "Date unknown". */
  undatedLabel?: string;
}

export function Timeline({ entries, undatedLabel = "Date unknown" }: TimelineProps) {
  if (entries.length === 0) return null;
  return (
    <ol className="cw-timeline">
      {entries.map((entry, i) => (
        <li className="cw-timeline__event" key={`${entry.date ?? "undated"}-${i}`}>
          <time className="cw-timeline__date" dateTime={entry.date ?? undefined}>
            {entry.date ?? undatedLabel}
          </time>
          <span className="cw-timeline__label">{entry.label}</span>
          {entry.detail != null && entry.detail !== "" && (
            <span className="cw-timeline__detail">{entry.detail}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
