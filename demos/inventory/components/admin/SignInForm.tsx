"use client";

import { useState } from "react";
import { AdminApiError, signIn } from "@/lib/adminApi";
import { button, card, input, label } from "@/components/admin/formStyles";

// The sign-in form. Replaces the shared-PIN prompt: admin actions are now
// attributed to a person in the activity log, which only works if people sign
// in as themselves.
export function SignInForm({ onSignedIn }: { onSignedIn?: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(username, password);
      setPassword("");
      onSignedIn?.();
    } catch (err) {
      // The server deliberately does not say whether it was the username or
      // the password, and neither does this.
      setError(
        err instanceof AdminApiError ? err.message : "Could not sign in.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={card}>
      <h1 className="text-lg font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-steel-600 dark:text-steel-400">
        Admin tools are signed in by name, so corrections and deletions are
        recorded against the person who made them.
      </p>

      <div className="mt-4">
        <label className={label} htmlFor="username">
          Username
        </label>
        <input
          id="username"
          className={input}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          autoFocus
        />
      </div>

      <div className="mt-3">
        <label className={label} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          className={input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button className={button} disabled={busy || !username || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {error && <span className="text-sm text-stock-none">{error}</span>}
      </div>
    </form>
  );
}
