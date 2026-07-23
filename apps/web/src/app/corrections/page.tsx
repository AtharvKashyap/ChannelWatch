import { CORRECTION_PAGE_COPY, SITE_COPY } from "@channelwatch/schemas";
import { CorrectionForm } from "../../components/index.js";

/**
 * The public correction page (`/corrections`, M3 Track C, SPEC §23.3 "Report an
 * Error"). Renders the `CorrectionForm`, which posts to
 * `POST /api/v1/corrections` via the api-client with Zod validation and honest
 * success/failure states. A `?channel=UC…` query param (linked from each channel
 * page) prefills the channel ID. All copy comes from the reviewed module
 * (CLAUDE.md rule 2). Rendered per-request so the prefill reflects the query.
 */
export const dynamic = "force-dynamic";

export default async function CorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>;
}) {
  const { channel } = await searchParams;

  return (
    <main>
      <h1>{CORRECTION_PAGE_COPY.heading}</h1>
      <p className="cw-muted">{CORRECTION_PAGE_COPY.intro}</p>
      <p className="cw-muted">{SITE_COPY.reportErrorIntro}</p>
      <CorrectionForm initialChannelId={(channel ?? "").trim()} />
    </main>
  );
}
