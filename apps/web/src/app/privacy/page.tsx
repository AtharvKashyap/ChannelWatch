import type { Metadata } from "next";
import { PRIVACY_PAGE_COPY } from "@channelwatch/schemas";

/**
 * The public privacy-policy page (`/privacy`, M3 Track F). The Chrome Web Store
 * requires a public privacy-policy URL; this is that page. Static content — a
 * faithful structured rendering of the reviewed `PRIVACY.md`, sourced entirely
 * from `PRIVACY_PAGE_COPY` in the copy module (CLAUDE.md rule 2). No API calls;
 * safe to statically render. Reuses the shared `.cw-methodology` content styling.
 */
export const metadata: Metadata = {
  title: `${PRIVACY_PAGE_COPY.heading} · CHANNELWATCH`,
};

export default function PrivacyPage() {
  const p = PRIVACY_PAGE_COPY;
  return (
    <main className="cw-methodology">
      <h1>{p.heading}</h1>
      <p>{p.intro}</p>

      <h2>{p.sendsHeading}</h2>
      <p className="cw-muted">{p.sendsIntro}</p>
      <ul>
        {p.sends.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>{p.sendsNote}</p>

      <h2>{p.neverHeading}</h2>
      <p className="cw-muted">{p.neverIntro}</p>
      <ul>
        {p.never.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="cw-muted">{p.avoidsIntro}</p>
      <ul>
        {p.avoids.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>{p.storageNote}</p>

      <h2>{p.telemetryHeading}</h2>
      <p className="cw-muted">{p.telemetryIntro}</p>
      <ul>
        {p.telemetry.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>{p.telemetryNote}</p>

      <h2>{p.subjectsHeading}</h2>
      <p>{p.subjectsBody}</p>
    </main>
  );
}
