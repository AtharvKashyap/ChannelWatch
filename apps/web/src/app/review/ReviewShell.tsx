"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { REVIEW_CONSOLE_COPY as C } from "@channelwatch/schemas";
import { ReviewNav } from "../../components/review/index.js";
import { fetchMe, logout } from "../../lib/review-client.js";

/**
 * Authed shell for the `/review` console pages. On mount it bootstraps the
 * session via `GET /auth/me`; an unauthenticated response redirects to the login
 * page (server-side session is the source of truth — the client holds no token).
 * Renders the shared nav + the signed-in reviewer + a sign-out control around the
 * page content.
 */
export function ReviewShell({
  active,
  children,
}: {
  active: "queue" | "entities" | "corrections" | "audit";
  children: ReactNode;
}) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchMe().then((r) => {
      if (cancelled) return;
      if (!r.ok) {
        router.replace("/review/login");
        return;
      }
      setEmail(r.data.reviewer.email);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const onSignOut = async () => {
    await logout();
    router.replace("/review/login");
  };

  if (!ready) return <p className="cw-loading">{C.loading}</p>;

  return (
    <div className="cw-review-shell">
      <ReviewNav active={active} signedInAs={email} onSignOut={onSignOut} />
      <main style={{ padding: "1rem" }}>{children}</main>
    </div>
  );
}
