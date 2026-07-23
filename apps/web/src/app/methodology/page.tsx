import type { Metadata } from "next";
import { METHODOLOGY_COPY } from "@channelwatch/schemas";

/**
 * The public methodology page (`/methodology`, M3 Track C). Static content — a
 * faithful structured rendering of `docs/METHODOLOGY.md`, sourced entirely from
 * the reviewed `METHODOLOGY_COPY` in the copy module (CLAUDE.md rule 2). No API
 * calls; safe to statically render.
 */
export const metadata: Metadata = {
  title: `${METHODOLOGY_COPY.heading} · CHANNELWATCH`,
};

export default function MethodologyPage() {
  const m = METHODOLOGY_COPY;
  return (
    <main className="cw-methodology">
      <h1>{m.heading}</h1>
      <p>{m.intro}</p>

      <h2>{m.evidenceTiersHeading}</h2>
      <p className="cw-muted">{m.evidenceTiersIntro}</p>
      <dl>
        {m.evidenceTiers.map((tier) => (
          <div key={tier.title}>
            <dt>{tier.title}</dt>
            <dd>{tier.description}</dd>
          </div>
        ))}
      </dl>

      <h2>{m.confidenceHeading}</h2>
      <p className="cw-muted">{m.confidenceIntro}</p>
      <dl>
        {m.confidenceLevels.map((level) => (
          <div key={level.title}>
            <dt>{level.title}</dt>
            <dd>{level.description}</dd>
          </div>
        ))}
      </dl>

      <h2>{m.thresholdsHeading}</h2>
      <p className="cw-muted">{m.thresholdsIntro}</p>
      <ul>
        {m.thresholds.map((band) => (
          <li key={band}>{band}</li>
        ))}
      </ul>

      <h2>{m.peRuleHeading}</h2>
      <p>{m.peRule}</p>

      <h2>{m.reviewHeading}</h2>
      <p className="cw-muted">{m.reviewIntro}</p>
      <ul>
        {m.reviewChecklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2>{m.twoPersonHeading}</h2>
      <p>{m.twoPersonIntro}</p>

      <h2>{m.llmHeading}</h2>
      <p>{m.llm}</p>
    </main>
  );
}
