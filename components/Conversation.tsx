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

// One panel, one input. No local game phases or duplicated game state.
export function Conversation({ game }: { game: GameController }) {
  const { state, busy, connected, remaining, error } = game;
  const [draft, setDraft] = useState(() =>
    state?.canCreate ? (state.revealedPreference ?? "") : "",
  );
  if (!state) return null;
  const me = state.you;
  const dialogue = me?.dialogue;
  const creating = state.canCreate;
  const waitingNames = state.seats.filter(s => s.kind === "human" && !s.submitted).map(s => s.name).join(", ");
  const speaker = state.seats.find((seat) => seat.id === state.speakerId);
  const canSpeak =
    me?.role === "suitor" &&
    state.phase === "dialogue" &&
    !me.submitted &&
    remaining !== 0;
  const manualAdvance = !!me && !state.timersEnabled && (
    ["feedback", "reveal"].includes(state.phase) ||
    (state.phase === "creating" && state.seats.find(s => s.id === state.winner?.seatId)?.kind === "npc")
  );
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
  const label =
    mode === "create"
      ? "Her secret preferences"
      : "Your answer to the princess";
  const description = !me
    ? "Taking your place at court…"
    : creating
      ? `You won! Edit up to ${PREFERENCE_EDIT_LIMIT} characters of her preferences. Additions, deletions, and replacements each count as one.`
      : state.revealedPreference
        ? `Her secret: “${state.revealedPreference}”`
        : state.phase === "lobby"
          ? "The court is waiting. Enter to begin."
          : me.role === "advisor"
            ? "You’re watching this contest. You’ll rejoin the next one."
            : me.role === "spectator"
              ? "You’ll automatically take the next available NPC seat."
              : state.thinking && speaker && !speaker.line
                ? `${speaker.name} is thinking…`
                : dialogue?.pending || state.thinking
                  ? "The princess is thinking…"
                  : dialogue
                    ? dialogue.reply
                    : canSpeak
                      ? remaining === null
                        ? "(What do you think the princess would like to hear?)"
                        : `${remaining}s. Then click Next.`
                      : "Click Next when you're ready for the following suitor.";

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
          The princess asks: “{state.prompt}”
        </p>
      )}
      {creating && <p className="m-0">{description}</p>}
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
          {dialogue.feedback}{" "}
          <strong className="ml-2">
            +{state.seats.find((s) => s.id === me?.seatId)?.lastScore ?? 0} pts
          </strong>
        </p>
      )}
      {mode ? (
        <form
          className="mt-1 flex items-center gap-2.5 max-md:flex-wrap max-md:gap-1.5 [@media(max-height:550px)]:flex-nowrap"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            className="min-w-0 flex-1 border-2 border-ink bg-[#fff7fc] px-3 py-2 text-ink"
            aria-label={label}
            aria-describedby={creating ? "preference-budget" : undefined}
            aria-invalid={overBudget || undefined}
            placeholder={
              mode === "create"
                ? "Likes quiet confidence. Hates flattery."
                : "Your answer…"
            }
            value={draft}
            maxLength={limit}
            autoComplete="off"
            disabled={busy || !connected}
            onChange={(e) => setDraft(e.target.value)}
          />
          <span
            id={creating ? "preference-budget" : undefined}
            className="shrink-0 text-sm"
            aria-live="polite"
          >
            {creating
              ? `${edits}/${PREFERENCE_EDIT_LIMIT} edits · ${draft.length}/${limit} chars`
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
        </form>
      ) : me?.role === "spectator" && state.seats.some(s => s.kind === "npc" && !(state.winner?.seatId === s.id && ["reveal", "creating"].includes(state.phase))) ? (
        <button className="mt-1 w-fit border-2 border-ink bg-ink px-4 py-2 text-paper" type="button" disabled={busy || !connected} onClick={() => void game.enter()}>
          {busy ? "…" : "Take an NPC seat →"}
        </button>
      ) : canAdvance || manualAdvance ? (
        <button
          className="mt-1 w-fit border-2 border-ink bg-ink px-4 py-2 text-paper"
          type="button"
          disabled={busy || !connected}
          onClick={() => void game.next()}
        >
          {busy ? "…" : state.phase === "feedback" ? state.turn === TURN_COUNT - 1 ? "Reveal winner →" : "Next question →" : state.phase === "reveal" ? "Continue →" : state.phase === "creating" ? "Meet the next princess →" : "Next →"}
        </button>
      ) : !["dialogue", "evaluating"].includes(state.phase) ||
        me?.role !== "suitor" ? (
        <p className="opacity-80">
          {state.phase === "reveal"
            ? "Ties: last-turn score, then seat order. Winner edits the next princess’s preferences shortly."
            : state.phase === "creating"
              ? state.timersEnabled ? `The court continues automatically if no prompt arrives in ${CREATE_MS / 1000}s.` : "Waiting for the winner to set the next princess’s preferences."
              : state.phase === "feedback"
                ? remaining === 0
                  ? "Continuing…"
                  : `${state.turn === TURN_COUNT - 1 ? "Winner revealed" : "Next turn starts"} in ${remaining ?? "…"}s.`
                : me?.role === "advisor"
                  ? "You’re watching this contest. You’ll rejoin the next one."
                  : state.phase === "lobby"
                  ? `Waiting for players: ${state.seats.filter(s => s.kind === "human").length}/${state.minPlayers ?? 1} needed to start. Share the invite link.`
                  : speaker
                    ? `Waiting for ${speaker.name}.`
                    : "Waiting for the rest of the court…"}
        </p>
      ) : null}
    </section>
  );
}
