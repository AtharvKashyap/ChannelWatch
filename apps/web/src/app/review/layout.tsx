import type { ReactNode } from "react";

/**
 * Layout for the authenticated `/review` console. Kept plain and functional — a
 * centered column shared by the login page and the authed sections. Auth
 * bootstrapping happens client-side in `ReviewShell` (the session lives in an
 * HttpOnly cookie the server validates), so this layout is a thin wrapper.
 */
export default function ReviewLayout({ children }: { children: ReactNode }) {
  return <div style={{ maxWidth: 1040, margin: "0 auto" }}>{children}</div>;
}
