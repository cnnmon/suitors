"use client";

import { useState } from "react";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function reset(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, action: "reset" }),
      });
      const raw = await response.text();
      let body: { error?: string; humans?: number; phase?: string };
      try { body = raw ? JSON.parse(raw) : {}; }
      catch { throw new Error("Admin reset is not available on this server."); }
      if (!response.ok) throw new Error(body.error || "The court could not be reset.");
      const humans = body.humans ?? 0;
      setMessage(humans > 0
        ? `Reset. ${humans} ${humans === 1 ? "player" : "players"} still here will reload and rejoin. The round starts from the beginning.`
        : "Reset. The public court is empty and waiting for the next round.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The court could not be reset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid w-[min(420px,calc(100vw-32px))] gap-4 border-2 border-ink bg-paper p-6">
      <h1 className="m-0 font-display uppercase">Court admin</h1>
      <p className="m-0">
        Reset the public court. Anyone still on the page reloads, rejoins, and the round starts from the beginning.
      </p>
      <form className="grid gap-3" onSubmit={(event) => void reset(event)}>
        <label className="grid gap-1">
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="border border-ink bg-white px-2 py-1"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !password}
          className="w-fit border-2 border-ink bg-ink px-4 py-2 text-paper no-underline disabled:opacity-50"
        >
          {busy ? "Resetting…" : "Reset the court"}
        </button>
      </form>
      {message && <p className="m-0" role="status">{message}</p>}
      {error && <p className="m-0" role="alert">{error}</p>}
    </main>
  );
}
