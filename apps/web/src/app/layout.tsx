import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { POPUP_COPY, SITE_COPY } from "@channelwatch/schemas";
import "./globals.css";

export const metadata: Metadata = {
  title: POPUP_COPY.title,
  description: POPUP_COPY.description,
};

/**
 * Root layout for the public site. Renders the shared navigation (home,
 * methodology, corrections) — all labels from the reviewed copy module — around
 * each page's content. The authed `/review` console is a separate track.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="cw-nav" aria-label="Primary">
          <div className="cw-nav__inner">
            <Link className="cw-nav__brand" href="/">
              {POPUP_COPY.title}
            </Link>
            <Link className="cw-nav__link" href="/">
              {SITE_COPY.navHome}
            </Link>
            <Link className="cw-nav__link" href="/methodology">
              {SITE_COPY.navMethodology}
            </Link>
            <Link className="cw-nav__link" href="/corrections">
              {SITE_COPY.navCorrections}
            </Link>
          </div>
        </nav>
        <div className="cw-shell">{children}</div>
      </body>
    </html>
  );
}
