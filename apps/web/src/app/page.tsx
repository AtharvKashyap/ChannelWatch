import type { Source } from "@channelwatch/schemas";
import { POPUP_COPY } from "@channelwatch/schemas";
import { Badge, ConfidenceLabel, EvidenceCard, Timeline } from "../components/index.js";

/**
 * Foundation home page. It exists to prove the wiring compiles and renders —
 * the pnpm/turbo integration, the `@channelwatch/schemas` types + copy module,
 * and the shared presentational components. Channel pages, the corrections
 * form, and the authed `/review` console are later tracks and are NOT built
 * here. All data below is placeholder demo data, not a published claim.
 */

const DEMO_SOURCE: Source = {
  id: "demo-source-1",
  url: "https://example.com/acquisition-announcement",
  title: "Example acquisition announcement",
  tier: 1,
  status: "ACTIVE",
  archive_url: "https://web.archive.org/web/2024/https://example.com/acquisition-announcement",
};

export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>{POPUP_COPY.title}</h1>
      <p>{POPUP_COPY.description}</p>

      <section aria-label="Component preview" style={{ marginTop: "2rem" }}>
        <h2>Foundation preview</h2>
        <p>
          This is scaffolding for the public site and the authenticated review console. The shared
          presentational components below render from placeholder data.
        </p>

        <p style={{ marginTop: "1.5rem" }}>
          <Badge label="CORPORATE_OWNED" name="Example Media Group" /> &nbsp;
          <ConfidenceLabel value="HIGH" />
        </p>

        <EvidenceCard source={DEMO_SOURCE} />

        <Timeline
          entries={[
            { date: "2021-11-04", label: "Example Media Group acquired the channel operator." },
            { date: null, label: "Founding of the channel." },
          ]}
        />
      </section>
    </main>
  );
}
