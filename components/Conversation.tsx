"use client";

import { useState } from "react";
import { preferenceEdits } from "@/lib/lobby/preferenceEdits";
import type { GameController } from "@/hooks/useGame";
import {
  MESSAGE_LIMIT,
  PREFERENCE_LIMIT,
  PREFERENCE_EDIT_LIMIT,
  CREATE_MS,
  TURN_COUNT,
} from "@/lib/lobby/settings";

export function Conversation({ game }: { game: GameController }) {
  const { state, busy, connected, remaining, error } = game;
  const [draft, setDraft] = useState(() =>
    state?.canCreate ? (state.revealedPreference ?? "") : "",
  );
  if (!state) return null;
  const me = state.you;
  const dialogue = me?.dialogue;
  const creating = state.canCreate;
  const speaker = state.seats.find((seat) => seat.id === state.speakerId);
  const canSpeak =
    me?.role === "suitor" &&
    state.phase === "dialogue" &&
    !me.submitted &&
    remaining !== 0;
  const manualAdvance =
    !!me &&
    !state.timersEnabled &&
    (["feedback", "reveal"].includes(state.phase) ||
      (state.phase === "creating" &&
        state.seats.find((s) => s.id === state.winner?.seatId)?.kind ===
          "npc"));
  const canAdvance =
    !!me &&
    state.phase === "results" &&
    !!speaker &&
    !dialogue?.pending &&
    !state.thinking;
  const mode = creating ? "create" : canSpeak ? "say" : null;
  const edits = creating
    ? preferenceEdits(state.revealedPreference ?? "", draft)
    : 0;
  const overBudget = creating && edits > PREFERENCE_EDIT_LIMIT;
  const limit = mode === "create" ? PREFERENCE_LIMIT : MESSAGE_LIMIT;
  const revealed = ["reveal", "creating"].includes(state.phase)
    ? state.revealedPreference
    : null;

  async function send() {
    if (!draft.trim() || !mode || overBudget) return;
    const ok = await (mode === "create"
      ? game.createPrincess(draft)
      : game.say(draft));
    if (ok) setDraft("");
  }
  return (
    <section
      className="flex shrink-0 flex-col gap-2 border-2 border-ink bg-paper p-3 shadow-[3px_3px_0_#0b4b28]"
      aria-label="Conversation"
    >
      {["lobby", "dialogue", "evaluating", "results", "feedback"].includes(
        state.phase,
      ) && (
        <p className="m-0 font-bold" aria-live="polite">
          The princess{" "}
          {state.phase === "results" || state.phase === "feedback"
            ? "asked"
            : "asks"}
          : “{state.prompt}”
        </p>
      )}
      {state.phase === "results" && speaker && (
        <div className="grid gap-1 border-l-4 border-ink/30 pl-3" aria-live="polite">
          <p className="m-0 break-words">
            <strong>{speaker.name}</strong>{" "}
            {speaker.line ? <>said: “{speaker.line}”</> : "didn’t answer."}
          </p>
          {speaker.mark != null && (
            <p className="m-0">
              The princess rated it <strong>{speaker.mark}/10</strong>.
            </p>
          )}
        </div>
      )}
      {state.phase === "lobby" && state.privateLobby && state.canConfigure && (
        <button
          className="w-fit border-2 border-ink bg-ink px-4 py-2 text-paper"
          disabled={
            busy ||
            !connected ||
            !me?.seatId ||
            state.seats.filter((s) => s.kind === "human").length <
              (state.minPlayers ?? 1)
          }
          onClick={() => void game.start()}
        >
          Start contest →
        </button>
      )}
      {revealed && (
        <div className="border-l-4 border-ink bg-white/50 px-4 py-3">
          <h2 className="m-0 text-xs font-bold uppercase tracking-wider">
            Her secret preferences
          </h2>
          <p className="mt-1 mb-0 break-words text-lg leading-snug">
            “{revealed}”
          </p>
        </div>
      )}
      {creating && (
        <p className="m-0 text-sm" id="preference-instructions">
          Shape the next princess. Change up to {PREFERENCE_EDIT_LIMIT}{" "}
          characters, or keep her tastes.
        </p>
      )}
      {state.phase === "evaluating" && (
        <p className="m-0" role="status">
          The princess is considering everyone’s answers…
        </p>
      )}
      {state.phase === "dialogue" && me?.submitted && (
        <p className="m-0" role="status">
          Answer sent. Waiting for{" "}
          {state.seats.filter((s) => s.kind === "human" && !s.submitted).length}{" "}
          other suitor(s)…
        </p>
      )}
      {error && (
        <p className="m-0" role="alert">
          {error}
        </p>
      )}
      {state.phase === "feedback" && dialogue && (
        <p>
          What the princess thought about your answer:{" "}
          {dialogue.feedback.toLowerCase().replace("very", "")}{" "}
          <strong className="ml-2">
            +{state.seats.find((s) => s.id === me?.seatId)?.lastScore ?? 0} pts
          </strong>
        </p>
      )}
      {mode ? (
        <form
          className={
            creating
              ? "mt-1 grid gap-2"
              : "mt-1 flex items-center gap-2.5 max-md:flex-wrap max-md:gap-1.5 [@media(max-height:550px)]:flex-nowrap"
          }
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {creating ? (
            <label className="grid gap-1 text-sm font-bold">
              The next princess’s preferences
              <textarea
                className="w-full resize-none border-2 border-ink bg-[#fff7fc] px-3 py-2 text-base font-normal leading-snug text-ink"
                aria-describedby="preference-instructions preference-budget"
                aria-invalid={overBudget || undefined}
                rows={2}
                value={draft}
                maxLength={limit}
                disabled={busy || !connected}
                onChange={(e) => setDraft(e.target.value)}
              />
            </label>
          ) : (
            <input
              className="min-w-0 flex-1 border-2 border-ink bg-[#fff7fc] px-3 py-2 text-ink"
              aria-label="Your answer to the princess"
              placeholder="Your answer…"
              value={draft}
              maxLength={limit}
              autoComplete="off"
              disabled={busy || !connected}
              onChange={(e) => setDraft(e.target.value)}
            />
          )}
          <div
            className={
              creating ? "flex items-center justify-between gap-3" : "contents"
            }
          >
            <span
              id={creating ? "preference-budget" : undefined}
              className="shrink-0 text-sm"
              aria-live="polite"
            >
              {creating
                ? `${edits}/${PREFERENCE_EDIT_LIMIT} character edits`
                : `${draft.length}/${limit}`}
            </span>
            <button
              className="border-2 border-ink bg-ink px-4 py-2 whitespace-nowrap text-paper"
              type="submit"
              disabled={busy || !draft.trim() || !connected || overBudget}
            >
              {busy
                ? "…"
                : mode === "create"
                  ? edits === 0
                    ? "Keep preferences →"
                    : "Save preferences →"
                  : "Send →"}
            </button>
          </div>
        </form>
      ) : me?.role === "spectator" && !me.entered ? (
        <button
          className="mt-1 w-fit border-2 border-ink bg-ink px-4 py-2 text-paper"
          type="button"
          disabled={busy || !connected}
          onClick={() => void game.enter()}
        >
          {busy ? "…" : "Join the court →"}
        </button>
      ) : canAdvance || manualAdvance ? (
        <button
          className="mt-1 w-fit border-2 border-ink bg-ink px-4 py-2 text-paper"
          type="button"
          disabled={busy || !connected}
          onClick={() => void game.next()}
        >
          {busy
            ? "…"
            : state.phase === "feedback"
              ? state.turn === TURN_COUNT - 1
                ? "Reveal winner →"
                : "Next question →"
              : state.phase === "reveal"
                ? "Continue →"
                : state.phase === "creating"
                  ? "Meet the next princess →"
                  : "Next answer →"}
        </button>
      ) : !["dialogue", "evaluating"].includes(state.phase) ||
        me?.role !== "suitor" ? (
        <p className="opacity-80 text-xs">
          {state.phase === "reveal"
            ? "The winner shapes the next princess’s tastes."
            : state.phase === "creating"
              ? state.timersEnabled
                ? `The court continues automatically if no prompt arrives in ${CREATE_MS / 1000}s.`
                : "Waiting for the winner to set the next princess’s preferences."
              : state.phase === "feedback"
                ? remaining === 0
                  ? "Continuing…"
                  : `${state.turn === TURN_COUNT - 1 ? "Winner revealed" : "Next turn starts"} in ${remaining ?? "…"}s.`
                : me?.role === "advisor"
                  ? "You’re watching this contest. You’ll rejoin the next one."
                  : state.phase === "lobby"
                    ? state.privateLobby
                      ? state.canConfigure
                        ? `${state.seats.filter((s) => s.kind === "human").length} seated. Start when you’re ready. Keep this lobby open; it closes 25 seconds after you disconnect.`
                        : "Waiting for the admin to start the contest."
                      : "Enter to begin."
                    : speaker
                      ? `Waiting for ${speaker.name}.`
                      : "Waiting for the rest of the court…"}
        </p>
      ) : null}
    </section>
  );
}
