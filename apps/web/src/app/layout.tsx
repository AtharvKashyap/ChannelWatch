import type { Metadata } from "next";
import type { ReactNode } from "react";
import { POPUP_COPY } from "@channelwatch/schemas";

export const metadata: Metadata = {
  title: POPUP_COPY.title,
  description: POPUP_COPY.description,
};

/**
 * Root layout shared by the future public site and the authed `/review`
 * console. This milestone ships only the shared foundation.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          lineHeight: 1.5,
          color: "#0f0f0f",
          backgroundColor: "#ffffff",
        }}
      >
        {children}
      </body>
    </html>
  );
}
