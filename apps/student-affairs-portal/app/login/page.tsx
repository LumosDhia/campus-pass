"use client";

import { useRef, useState, type FormEvent } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.status === 204) {
        window.location.assign("/");
        return;
      }
      if (res.status === 401) {
        setError("Invalid username or password.");
        setPassword("");
        setSubmitting(false);
        setTimeout(() => passwordRef.current?.focus(), 0);
        return;
      }
      throw new Error(`Sign-in failed (${res.status})`);
    } catch {
      setError("Sign-in is unavailable right now. Try again in a moment.");
      setSubmitting(false);
    }
  }

  return (
    <main className="shell login-shell">
      <p className="eyebrow">CampusPass</p>
      <h1>Student Affairs Portal</h1>
      <p>Sign in with your registrar account.</p>

      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            className="input"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={submitting}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            ref={passwordRef}
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />
        </div>
        <button className="btn" type="submit" disabled={submitting || !username || !password}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}
      </form>
    </main>
  );
}
