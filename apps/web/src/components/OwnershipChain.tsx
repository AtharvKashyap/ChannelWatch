import {
  CHAIN_COPY,
  ownershipMechanismText,
  ownershipStakeText,
  type OwnershipChainStep,
} from "@channelwatch/schemas";

/**
 * The "Ownership chain" section (SPEC §18.3), channel-owner upward. Presents the
 * SAME `ownership_chain` data as the extension panel with the SAME legal-safe
 * phrasing — richer layout allowed. Each hop shows the full (untruncated) entity
 * name, the neutral sourced mechanism, the stake (exact percentage when
 * disclosed, else "stake not publicly disclosed"), and the effective-from date
 * when present. Every user-facing string comes from the reviewed copy module
 * (CLAUDE.md rule 2).
 */
export interface OwnershipChainProps {
  steps: OwnershipChainStep[];
}

export function OwnershipChain({ steps }: OwnershipChainProps) {
  if (steps.length === 0) return null;
  return (
    <section className="cw-chain" aria-label={CHAIN_COPY.heading}>
      <h2>{CHAIN_COPY.heading}</h2>
      <ol className="cw-chain__list">
        {steps.map((step, i) => (
          <ChainHop key={`${step.name}-${i}`} step={step} />
        ))}
      </ol>
    </section>
  );
}

function ChainHop({ step }: { step: OwnershipChainStep }) {
  const mechanism = ownershipMechanismText(step.relationship, step.control_level);
  const stake = ownershipStakeText(step.ownership_percentage);
  return (
    <li className="cw-chain__hop">
      <span className="cw-chain__name">{step.name}</span>
      <span className="cw-chain__meta">
        {mechanism} · {stake}
        {step.effective_from ? ` · ${CHAIN_COPY.effectiveFromPrefix} ${step.effective_from}` : ""}
      </span>
    </li>
  );
}
