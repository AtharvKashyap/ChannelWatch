"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "../../../components/review/index.js";
import { login } from "../../../lib/review-client.js";

/**
 * Reviewer login page. On success the API sets the HttpOnly session cookie and
 * we navigate into the console; on failure the form shows the reviewed error.
 */
export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div style={{ maxWidth: 420, margin: "3rem auto", padding: "1rem" }}>
      <LoginForm
        busy={busy}
        error={error}
        onSubmit={async (email, password) => {
          setBusy(true);
          setError(false);
          const result = await login(email, password);
          setBusy(false);
          if (result.ok) {
            router.replace("/review");
          } else {
            setError(true);
          }
        }}
      />
    </div>
  );
}
