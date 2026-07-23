import { EDITORIAL_DISCLAIMER, type Source } from "@channelwatch/schemas";

/**
 * Presents a single evidence `Source` (SPEC §7.1, §8.2) — the schema type is
 * consumed directly from `@channelwatch/schemas`; this component redefines no
 * response shape. Shows the title (falling back to the URL), a link to the
 * source, its archived snapshot when present, and the source tier/status when
 * graded (a null tier/status is a legitimate "not yet assigned" state and is
 * simply not rendered).
 *
 * The standing editorial disclaimer (§23.1, verbatim from the copy module) is
 * rendered on every evidence card: wherever evidence is shown, the disclaimer
 * that no conclusion is drawn about editorial interference is shown with it
 * (CLAUDE.md rule 2 / project constitution).
 */
export interface EvidenceCardProps {
  source: Source;
}

export function EvidenceCard({ source }: EvidenceCardProps) {
  const heading = source.title && source.title.trim() !== "" ? source.title : source.url;
  return (
    <article className="cw-evidence">
      <h3 className="cw-evidence__title">
        <a href={source.url} target="_blank" rel="noopener noreferrer">
          {heading}
        </a>
      </h3>
      <dl className="cw-evidence__meta">
        {source.tier != null && (
          <div className="cw-evidence__row">
            <dt>Source tier</dt>
            <dd>Tier {source.tier}</dd>
          </div>
        )}
        {source.status != null && (
          <div className="cw-evidence__row">
            <dt>Status</dt>
            <dd>{source.status}</dd>
          </div>
        )}
        {source.archive_url != null && source.archive_url !== "" && (
          <div className="cw-evidence__row">
            <dt>Archived copy</dt>
            <dd>
              <a href={source.archive_url} target="_blank" rel="noopener noreferrer">
                {source.archive_url}
              </a>
            </dd>
          </div>
        )}
      </dl>
      <p className="cw-evidence__disclaimer">{EDITORIAL_DISCLAIMER}</p>
    </article>
  );
}
