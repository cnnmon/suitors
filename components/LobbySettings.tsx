"use client";

import { useState } from "react";
import { MAX_PLAYERS } from "@/lib/lobby/settings";

export function LobbySettings({ onClose, initial, onSave, started = false }: {
  onClose: () => void;
  initial?: { capacity: number; winnerSitsOut: boolean };
  onSave?: (settings: { capacity: number; winnerSitsOut: boolean }) => Promise<boolean>;
  started?: boolean;
}) {
  const [capacity, setCapacity] = useState(initial?.capacity ?? MAX_PLAYERS);
  const [winnerSitsOut, setWinnerSitsOut] = useState(initial?.winnerSitsOut ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true); setError("");
    try {
      if (onSave) {
        if (!await onSave({ capacity, winnerSitsOut })) throw new Error("Could not save settings. Try again.");
        onClose();
      } else {
        const response = await fetch("/api/lobby", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "newLobby", capacity, winnerSitsOut }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not create lobby.");
        window.location.assign(result.url);
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Try again."); }
    finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-6">
      <form role="dialog" aria-modal="true" aria-labelledby="lobby-settings" className="grid w-full max-w-md gap-5 border-2 border-ink bg-paper p-6 text-sm shadow-[4px_4px_0_#0b4b28]" onSubmit={e => { e.preventDefault(); void save(); }}>
        <h2 id="lobby-settings" className="m-0 font-display text-xl">{onSave ? "Lobby settings" : "Your own court"}</h2>
        {!onSave && <p className="m-0">Create a separate game and invite friends with its link. Empty seats are played by NPCs.</p>}
        <label className="grid gap-2">
          <strong>Player limit</strong>
          <select aria-label="Player limit" className="border border-ink bg-white p-2" value={capacity} disabled={busy || started} onChange={e => setCapacity(Number(e.target.value))}>
            {Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{n} players</option>)}
          </select>
          {started && <span className="text-xs opacity-70">Reset the contest to change the player limit.</span>}
        </label>
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 accent-ink" checked={winnerSitsOut} disabled={busy} onChange={e => setWinnerSitsOut(e.target.checked)} />
          <span><strong className="block">Winner sits out next contest</strong><span className="text-xs opacity-70">{winnerSitsOut ? "The winner sets the preferences, then watches one contest." : "The winner sets the preferences, then plays again under a new name."} Changes apply at the next succession.</span></span>
        </label>
        {error && <p className="m-0" role="alert">{error}</p>}
        <div className="flex justify-end gap-4">
          <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="border border-ink bg-ink px-4 py-2 text-paper" disabled={busy}>{busy ? "…" : onSave ? "Save settings" : "Create lobby →"}</button>
        </div>
      </form>
    </div>
  );
}
