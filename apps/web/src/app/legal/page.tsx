import Link from "next/link";
import { LEGAL_PAGE_COPY } from "@channelwatch/schemas";

/**
 * The public legal-notices page (`/legal`, M3 Track F, launch-checklist item
 * 1.12): the DMCA notice-and-takedown process and the standing content-dispute
 * path. All copy comes from the reviewed module (CLAUDE.md rule 2). The
 * designated-agent contact renders the copy module's NEEDS-HUMAN placeholder
 * until a human registers an agent with the US Copyright Office and replaces
 * it — launch is blocked on that edit (docs/launch-checklist.md item 6.6).
 * Fully static content.
 */
export default function LegalPage() {
  return (
    <main>
      <h1>{LEGAL_PAGE_COPY.heading}</h1>
      <p className="cw-muted">{LEGAL_PAGE_COPY.intro}</p>

      <section>
        <h2>{LEGAL_PAGE_COPY.disputeHeading}</h2>
        <p>{LEGAL_PAGE_COPY.disputeBody}</p>
        <p>
          <Link href="/corrections">{LEGAL_PAGE_COPY.disputeLinkText}</Link>
        </p>
      </section>

      <section>
        <h2>{LEGAL_PAGE_COPY.dmcaHeading}</h2>
        <p>{LEGAL_PAGE_COPY.dmcaBody}</p>
        <p>{LEGAL_PAGE_COPY.dmcaProcessBody}</p>
      </section>

      <section>
        <h2>{LEGAL_PAGE_COPY.agentHeading}</h2>
        <p data-cw-needs-human="designated-agent">{LEGAL_PAGE_COPY.agentContact}</p>
      </section>
    </main>
  );
}
