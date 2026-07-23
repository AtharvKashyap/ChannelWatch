"use client";

import { useState } from "react";
import { REVIEW_CONSOLE_COPY as C } from "@channelwatch/schemas";

/**
 * Reviewer sign-in form (SPEC §19.1 reviewer authentication). Presentational: it
 * owns the email/password fields and raises `onSubmit`. `error` is shown when a
 * sign-in attempt failed. Copy comes from the reviewed module (CLAUDE.md rule 2).
 */
export interface LoginFormProps {
  busy?: boolean;
  error?: boolean;
  onSubmit: (email: string, password: string) => void;
}

export function LoginForm({ busy = false, error = false, onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      className="cw-login"
      aria-label={C.loginHeading}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(email.trim(), password);
      }}
    >
      <h1>{C.loginHeading}</h1>
      {error ? (
        <p className="cw-error" role="alert">
          {C.loginError}
        </p>
      ) : null}
      <label>
        {C.loginEmailLabel}
        <input
          className="cw-login-email"
          type="email"
          value={email}
          required
          autoComplete="username"
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        {C.loginPasswordLabel}
        <input
          className="cw-login-password"
          type="password"
          value={password}
          required
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <button type="submit" className="cw-login-submit" disabled={busy}>
        {busy ? C.loginSubmitting : C.loginSubmit}
      </button>
    </form>
  );
}
