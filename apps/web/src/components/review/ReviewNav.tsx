"use client";

import { REVIEW_CONSOLE_COPY as C } from "@channelwatch/schemas";

/**
 * Navigation shell for the `/review` console. Presentational: renders the four
 * section links (Queue, Entities, Corrections, Audit), the signed-in reviewer,
 * and a sign-out control. Copy comes from the reviewed module (CLAUDE.md rule 2).
 */
export interface ReviewNavProps {
  active: "queue" | "entities" | "corrections" | "audit";
  signedInAs?: string | null;
  onSignOut: () => void;
}

const LINKS: { key: ReviewNavProps["active"]; href: string; label: string }[] = [
  { key: "queue", href: "/review", label: C.navQueue },
  { key: "entities", href: "/review/entities", label: C.navEntities },
  { key: "corrections", href: "/review/corrections", label: C.navCorrections },
  { key: "audit", href: "/review/audit", label: C.navAudit },
];

export function ReviewNav({ active, signedInAs, onSignOut }: ReviewNavProps) {
  return (
    <header className="cw-review-nav">
      <strong className="cw-review-title">{C.consoleTitle}</strong>
      <nav aria-label={C.consoleTitle}>
        <ul>
          {LINKS.map((link) => (
            <li key={link.key}>
              <a href={link.href} aria-current={active === link.key ? "page" : undefined}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <span className="cw-review-user">
        {signedInAs ? `${C.signedInAs} ${signedInAs}` : null}
        <button type="button" className="cw-signout" onClick={onSignOut}>
          {C.navSignOut}
        </button>
      </span>
    </header>
  );
}
