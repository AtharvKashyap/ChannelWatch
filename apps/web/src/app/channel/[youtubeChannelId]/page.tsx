import Link from "next/link";
import {
  CONFIDENCE_LABEL_TEXT,
  EDITORIAL_DISCLAIMER,
  PANEL_COPY,
  SITE_COPY,
  CORRECTION_CTA,
  EXPLANATION_TEXT,
  ownershipMechanismText,
  evidenceCountText,
  lastReviewedText,
  type ChannelEvidenceItem,
  type ChannelTimelineEvent,
  type ClassificationLabel,
  type ResearchedChannelLookup,
  type Source,
} from "@channelwatch/schemas";
import {
  Badge,
  ConfidenceLabel,
  EvidenceCard,
  OwnershipChain,
  OwnershipHistory,
  Timeline,
  UnresearchedNotice,
  type TimelineEntry,
} from "../../../components/index.js";
import {
  fetchChannelEvidence,
  fetchChannelLookup,
  fetchChannelTimeline,
} from "../../../lib/api-client.js";

/**
 * The public channel page (`/channel/[youtubeChannelId]`, M3 Track C). Presents
 * the SAME data as the extension panel with the SAME legal-safe phrasing, in a
 * richer layout: classification badge + confidence + summary, direct owner and
 * ultimate parent, the ownership chain, the "Ownership over time" history, the
 * itemized evidence list, and a timeline. Unresearched channels render the
 * neutral UNRESEARCHED state; every user-facing string comes from the reviewed
 * copy module (CLAUDE.md rule 2). Fails gracefully on API errors. Rendered
 * per-request so the data is always live.
 */
export const dynamic = "force-dynamic";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ youtubeChannelId: string }>;
}) {
  const { youtubeChannelId } = await params;
  const lookup = await fetchChannelLookup(youtubeChannelId);

  if (!lookup.ok) {
    return (
      <main>
        <p className="cw-muted">{SITE_COPY.lookupError}</p>
        <p>
          <Link href="/">{SITE_COPY.backToSearch}</Link>
        </p>
      </main>
    );
  }

  if (!lookup.data.researched) {
    return (
      <main>
        <h1>{youtubeChannelId}</h1>
        <UnresearchedNotice />
        <ReportErrorLink channelId={youtubeChannelId} />
      </main>
    );
  }

  const payload = lookup.data;
  return <ResearchedChannel payload={payload} />;
}

/** The operative entity name shown IN the badge for name-suffixed labels. */
function operativeName(payload: ResearchedChannelLookup): string | null {
  const label: ClassificationLabel = payload.classification.label;
  if (label === "PE_BACKED") return payload.ultimate_parent?.name ?? null;
  if (label === "CORPORATE_OWNED" || label === "NONPROFIT_OWNED") {
    return payload.direct_owner?.name ?? null;
  }
  return null;
}

async function ResearchedChannel({ payload }: { payload: ResearchedChannelLookup }) {
  const { classification } = payload;
  const evidence = payload.channel_id ? await fetchChannelEvidence(payload.channel_id) : null;
  const timeline = payload.channel_id ? await fetchChannelTimeline(payload.channel_id) : null;

  return (
    <main>
      <h1>{payload.display_name}</h1>

      <section aria-label={SITE_COPY.overviewHeading}>
        <p>
          <Badge label={classification.label} name={operativeName(payload)} />{" "}
          <ConfidenceLabel value={classification.confidence_label} />
        </p>
        <p className="cw-summary">{classification.summary}</p>

        <dl className="cw-facts">
          {payload.direct_owner && (
            <Fact term={PANEL_COPY.directOwnerLabel} value={payload.direct_owner.name} />
          )}
          {payload.ultimate_parent && (
            <Fact term={PANEL_COPY.ultimateParentLabel} value={payload.ultimate_parent.name} />
          )}
          <Fact
            term={PANEL_COPY.confidenceLabel}
            value={CONFIDENCE_LABEL_TEXT[classification.confidence_label]}
          />
          <Fact term={PANEL_COPY.evidenceLabel} value={evidenceCountText(payload.evidence_count)} />
          <Fact term={PANEL_COPY.lastReviewedLabel} value={lastReviewedText(payload.last_reviewed_at)} />
        </dl>

        {payload.warnings.length > 0 && (
          <ul>
            {payload.warnings.map((code) => (
              <li key={code} className="cw-muted">
                {EXPLANATION_TEXT[code]}
              </li>
            ))}
          </ul>
        )}

        <p className="cw-disclaimer">{EDITORIAL_DISCLAIMER}</p>
      </section>

      {payload.ownership_chain && <OwnershipChain steps={payload.ownership_chain} />}
      {payload.ownership_history && <OwnershipHistory entries={payload.ownership_history} />}

      <EvidenceSection evidence={evidence} />
      <TimelineSection timeline={timeline} />

      <ReportErrorLink channelId={payload.youtube_channel_id} />
    </main>
  );
}

/** Itemized evidence, each with the standing editorial disclaimer. */
function EvidenceSection({
  evidence,
}: {
  evidence: Awaited<ReturnType<typeof fetchChannelEvidence>> | null;
}) {
  const items = evidence && evidence.ok ? evidence.data.evidence : [];
  return (
    <section aria-label={SITE_COPY.evidenceHeading}>
      <h2>{SITE_COPY.evidenceHeading}</h2>
      {items.length === 0 ? (
        <p className="cw-muted">{SITE_COPY.evidenceEmpty}</p>
      ) : (
        items.map((item) => <EvidenceCard key={item.id} source={toSource(item)} />)
      )}
    </section>
  );
}

/** Map an API evidence item onto the `Source` shape the EvidenceCard consumes. */
function toSource(item: ChannelEvidenceItem): Source {
  return {
    id: item.id,
    url: item.url,
    title: item.title ?? null,
    tier: item.tier ?? null,
    status: item.status ?? null,
    archive_url: item.archive_url ?? null,
  };
}

/**
 * The ownership timeline. Only RELATIONSHIP events are shown: their type maps to
 * a neutral, reviewed mechanism phrase (`ownershipMechanismText`). Claim events
 * carry internal predicate strings that are not in the reviewed vocabulary, so
 * they are not rendered as public prose.
 */
function TimelineSection({
  timeline,
}: {
  timeline: Awaited<ReturnType<typeof fetchChannelTimeline>> | null;
}) {
  const events = timeline && timeline.ok ? timeline.data.events : [];
  const entries: TimelineEntry[] = events
    .filter((e) => e.kind === "RELATIONSHIP")
    .map(toTimelineEntry)
    // newest-first for display
    .reverse();

  return (
    <section aria-label={SITE_COPY.timelineHeading}>
      <h2>{SITE_COPY.timelineHeading}</h2>
      {entries.length === 0 ? (
        <p className="cw-muted">{SITE_COPY.timelineEmpty}</p>
      ) : (
        <Timeline entries={entries} undatedLabel={SITE_COPY.timelineUndated} />
      )}
    </section>
  );
}

function toTimelineEntry(event: ChannelTimelineEvent): TimelineEntry {
  // control_level is not carried on timeline events; UNKNOWN yields the neutral
  // structural phrase (never an inferred "controlling"/"majority").
  const mechanism = ownershipMechanismText(
    event.type as Parameters<typeof ownershipMechanismText>[0],
    "UNKNOWN",
  );
  const subject = event.subject ?? event.object ?? "";
  const other = event.object && event.subject ? event.object : null;
  return {
    date: event.date,
    label: subject,
    detail: other ? `${mechanism} · ${other}` : mechanism,
  };
}

function ReportErrorLink({ channelId }: { channelId: string }) {
  return (
    <p>
      <Link href={`/corrections?channel=${encodeURIComponent(channelId)}`}>{CORRECTION_CTA}</Link>
    </p>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt>{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}
