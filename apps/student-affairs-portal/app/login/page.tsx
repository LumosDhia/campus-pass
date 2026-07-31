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
    <main className="login-wrap">
      <form className="card login-card" onSubmit={handleSubmit}>
        <div className="logo">
          <span className="logo-mark" />
          <div>
            <div className="logo-name">CampusPass</div>
            <div className="logo-sub">Student affairs</div>
          </div>
        </div>
        <h1 className="login-title">Student Affairs Portal</h1>
        <p>Sign in with your registrar account.</p>
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
        {error && <p className="error-text">{error}</p>}
      </form>
    </main>
  );
}
