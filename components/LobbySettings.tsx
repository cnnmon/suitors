"use client";

import { useState } from "react";
import type { LobbyOptions } from "@/lib/lobby/options";
import { MAX_PLAYERS } from "@/lib/lobby/settings";

export function LobbySettings({
  onClose,
  initial,
  onSave,
  started = false,
}: {
  onClose: () => void;
  initial?: LobbyOptions;
  onSave?: (settings: LobbyOptions) => Promise<boolean>;
  started?: boolean;
}) {
  const [minPlayers, setMinPlayers] = useState<number | null>(initial?.minPlayers ?? null);
  const [maxPlayers, setMaxPlayers] = useState<number | null>(initial?.maxPlayers ?? null);
  const [timersEnabled, setTimersEnabled] = useState(initial?.timersEnabled ?? true);
  const [winnerSitsOut, setWinnerSitsOut] = useState(
    initial?.winnerSitsOut ?? false,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (onSave) {
        if (!(await onSave({ minPlayers, maxPlayers, timersEnabled, winnerSitsOut })))
          throw new Error("Could not save settings. Try again.");
        onClose();
      } else {
        const response = await fetch("/api/lobby", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "newLobby", minPlayers, maxPlayers, timersEnabled, winnerSitsOut }),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Could not create lobby.");
        window.location.assign(result.url);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-6">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="lobby-settings"
        className="grid w-full max-w-md gap-5 border-2 border-ink bg-paper p-6 text-sm shadow-[4px_4px_0_#0b4b28]"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <h2 id="lobby-settings" className="m-0 font-display text-xl">
          {onSave ? "Lobby settings" : "Your own court"}
        </h2>
        {!onSave && (
          <p className="m-0">
            Create a separate game and invite friends with its link. Empty seats
            are played by NPCs. You are the admin: start when ready, and keep this tab open. The lobby closes if you disconnect for 25 seconds.
          </p>
        )}
        <fieldset className="grid grid-cols-2 gap-3 border-0 p-0">
          <legend className="mb-2 font-bold">Player limits (optional)</legend>
          <label className="grid gap-2">
            <span className="flex items-center gap-2"><input type="checkbox" checked={minPlayers !== null} disabled={busy || started} onChange={e => setMinPlayers(e.target.checked ? 2 : null)} />Minimum</span>
            {minPlayers !== null && <input aria-label="Minimum players" type="number" min={1} max={maxPlayers ?? MAX_PLAYERS} value={minPlayers} disabled={busy || started} onChange={e => setMinPlayers(Number(e.target.value))} className="w-full border border-ink bg-white p-2" />}
          </label>
          <label className="grid gap-2">
            <span className="flex items-center gap-2"><input type="checkbox" checked={maxPlayers !== null} disabled={busy || started} onChange={e => setMaxPlayers(e.target.checked ? MAX_PLAYERS : null)} />Maximum</span>
            {maxPlayers !== null && <input aria-label="Maximum players" type="number" min={Math.max(2, minPlayers ?? 2)} max={MAX_PLAYERS} value={maxPlayers} disabled={busy || started} onChange={e => setMaxPlayers(Number(e.target.value))} className="w-full border border-ink bg-white p-2" />}
          </label>
          <p className="col-span-2 m-0 text-xs opacity-70">{started ? "Reset the contest to change player limits." : "No minimum: start alone with NPCs. No maximum selected: up to 15 players. A minimum counts humans, not NPCs."}</p>
        </fieldset>
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 accent-ink" checked={timersEnabled} disabled={busy} onChange={e => setTimersEnabled(e.target.checked)} />
          <span><strong className="block">Timers</strong><span className="text-xs opacity-70">{timersEnabled ? "Timed answers and automatic transitions." : "No answer deadlines. Use Next to advance the contest."}</span></span>
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 accent-ink"
            checked={winnerSitsOut}
            disabled={busy}
            onChange={(e) => setWinnerSitsOut(e.target.checked)}
          />
          <span>
            <strong className="block">Winner sits out next contest</strong>
            <span className="text-xs opacity-70">
              {winnerSitsOut
                ? "The winner sets the preferences, then watches one contest."
                : "The winner sets the preferences, then plays again under a new name."}{" "}
              Changes apply at the next succession.
            </span>
          </span>
        </label>
        {error && (
          <p className="m-0" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-4">
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            className="border border-ink bg-ink px-4 py-2 text-paper"
            disabled={busy}
          >
            {busy ? "…" : onSave ? "Save settings" : "Create lobby →"}
          </button>
        </div>
      </form>
    </div>
  );
}
