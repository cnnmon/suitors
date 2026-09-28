"use client";

import { useCallback, useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import { useGame } from "@/hooks/useGame";
import type { Lineage } from "@/lib/lobby/lineage";
import { Conversation } from "./Conversation";
import { LobbySettings } from "./LobbySettings";
import { Stage } from "./Stage";
import { TURN_COUNT, PREFERENCE_EDIT_LIMIT } from "@/lib/lobby/settings";

const frame = "relative h-[600px] w-[980px] shrink-0 overflow-hidden";

function Lineages({
  onClose,
  lobbyId,
}: {
  onClose: () => void;
  lobbyId?: string;
}) {
  const [lines, setLines] = useState<Lineage[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    fetch(
      `/api/lineage${lobbyId ? `?lobby=${encodeURIComponent(lobbyId)}` : ""}`,
      { cache: "no-store" },
    )
      .then((response) => {
        if (!response.ok) throw new Error("lineage");
        return response.json() as Promise<Lineage[]>;
      })
      .then(setLines)
      .catch(() => setFailed(true));
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, lobbyId]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lineages"
        className="grid max-h-[min(520px,calc(100dvh-48px))] w-full max-w-[640px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-2 border-ink bg-paper text-sm leading-relaxed shadow-[4px_4px_0_#0b4b28]"
      >
        <header className="flex items-start justify-between gap-6 border-b border-ink/20 px-6 py-4">
          <div>
            <h2 id="lineages" className="m-0 font-display text-xl uppercase">
              Past lineages
            </h2>
            <p className="mt-1 mb-0 text-xs opacity-70">
              The winners, her tastes, and the words that won.
            </p>
          </div>
          <button
            className="shrink-0 px-1 text-xl leading-none no-underline"
            aria-label="Close lineages"
            autoFocus
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain px-6 py-5 [scrollbar-gutter:stable]">
          {!lines && !failed && (
            <p className="m-0" role="status">
              Opening the royal archive…
            </p>
          )}
          {failed && (
            <p className="m-0" role="alert">
              The lineages could not be opened.
            </p>
          )}
          {lines && !lines.length && (
            <p className="m-0">No reign has ended yet.</p>
          )}
          {lines?.map((line) => (
            <section
              key={line.reign}
              className="overflow-hidden border border-ink/25 bg-white/30"
            >
              <div className="flex items-baseline justify-between gap-4 border-b border-ink/15 px-4 py-3">
                <h3 className="m-0 font-display text-lg uppercase break-words">
                  {line.winner}
                </h3>
                <span className="shrink-0 text-xs uppercase tracking-wider">
                  Winner · Reign {line.reign}
                </span>
              </div>
              <div className="border-b border-ink/15 bg-ink/5 px-4 py-3">
                <p className="m-0 text-[10px] font-bold uppercase tracking-widest opacity-60">
                  Her hidden preferences
                </p>
                <p className="mt-1 mb-0 break-words">{line.preference}</p>
              </div>
              <ol className="m-0 list-none divide-y divide-ink/15 p-0">
                {line.said.map((speech, index) => (
                  <li
                    key={`${index}:${speech.question}`}
                    className="grid grid-cols-[20px_minmax(0,1fr)] gap-3 px-4 py-3"
                  >
                    <span className="pt-0.5 text-xs opacity-50">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="m-0 text-xs opacity-70 break-words">
                        {speech.question}
                      </p>
                      <blockquote className="mt-1 mb-0 ml-0 border-l-2 border-ink/30 pl-3 font-medium break-words">
                        “{speech.text}”
                      </blockquote>
                    </div>
                  </li>
                ))}
              </ol>
              {!line.said.length && (
                <p className="m-0 px-4 py-3 opacity-60">No answers recorded.</p>
              )}
            </section>
          ))}
        </div>
        <footer className="flex justify-end border-t border-ink/20 px-6 py-3">
          <button
            className="border border-ink bg-ink px-4 py-2 text-xs text-paper no-underline"
            onClick={onClose}
          >
            Back to court →
          </button>
        </footer>
      </div>
    </div>
  );
}

function HowToPlay({
  onClose,
  required = false,
  onCreateLobby,
  winnerSitsOut = false,
  privateLobby = false,
}: {
  onClose: () => void;
  required?: boolean;
  onCreateLobby?: () => void;
  winnerSitsOut?: boolean;
  privateLobby?: boolean;
}) {
  useEffect(() => {
    if (required) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, required]);
  return (
    <div className="fixed inset-0 z-[50] grid place-items-center bg-black/55 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-to-play"
        className="grid max-w-md gap-3 border-2 border-ink bg-paper p-4 shadow-[3px_3px_0_#0b4b28]"
      >
        <h2 id="how-to-play" className="m-0 font-display uppercase">
          how to play
        </h2>
        <p className="m-0">
          You're seated at court as a suitor. Answer the princess's questions
          and use her reactions and scores to uncover her hidden tastes.
        </p>
        <p className="m-0">
          After {TURN_COUNT} turns, the highest-scoring suitor wins her hand and
          reveals her preferences. You may change up to {PREFERENCE_EDIT_LIMIT}{" "}
          characters of her tastes, then{" "}
          {winnerSitsOut
            ? "watch the next contest."
            : "rejoin the next reign under a new name."}
        </p>
        <div className="flex justify-center items-center flex-col gap-2">
          <button
            className="w-fit border-2 border-ink bg-ink px-4 py-2 text-paper"
            autoFocus
            onClick={onClose}
          >
            {privateLobby ? "Take your seat" : "Enter the public court"}
          </button>
          {onCreateLobby && (
            <button className="text-sm" onClick={onCreateLobby}>
              Create a private lobby
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Game({ lobbyId }: { lobbyId?: string }) {
  const game = useGame(lobbyId);
  const { state, connected, clock } = game;
  const [intro, setIntro] = useState(true);
  const [lineages, setLineages] = useState(false);
  const [settingsMode, setSettingsMode] = useState<"create" | "edit" | null>(
    null,
  );
  const [invite, setInvite] = useState("");
  const [copied, setCopied] = useState(false);
  async function copyInvite() {
    const url = `${window.location.origin}/l/${lobbyId}`;
    setInvite(url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  const closeIntro = useCallback(() => setIntro(false), []);

  if (!state) {
    return (
      <main
        className={twMerge(frame, "grid place-items-center bg-[#eed9ec]")}
        role="status"
      >
        {game.error || "Taking your place at court…"}
        {intro && <HowToPlay privateLobby={!!lobbyId} onClose={closeIntro} />}
      </main>
    );
  }

  if (state.closedAt != null) return (
    <main className={twMerge(frame, "grid place-content-center gap-4 bg-paper p-8 text-center")}>
      <h1 className="font-display text-2xl">This lobby has closed</h1>
      <p>The admin disconnected. This invite link is no longer active.</p>
      <a href="/">Return to the public court →</a>
    </main>
  );

  return (
    <main
      className={twMerge(
        frame,
        "grid grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-2 overflow-hidden bg-[#eed9ec] bg-[url('/art/texturedbg.png')] bg-cover bg-center p-3",
      )}
    >
      <header className="flex shrink-0 items-start justify-between gap-4">
        <h1 className="m-0 min-w-0 overflow-visible pt-1 font-display text-2xl uppercase">
          the suitors and
          <br />
          the ai princess
        </h1>
        <div className="grid shrink-0 justify-items-end gap-1 whitespace-nowrap">
          {lobbyId && (
            <span className="bg-paper px-1 text-xs">
              {state.canConfigure ? "Your lobby · Admin" : "Invite lobby"} ·{" "}
              {state.seats.filter((s) => s.kind === "human").length}/
              {state.capacity} players
            </span>
          )}
          <div className="flex gap-3 bg-paper px-1 text-sm">
            {lobbyId && (
              <button onClick={() => void copyInvite()}>
                {copied ? "Link copied!" : "Copy invite link"}
              </button>
            )}
            {state.canConfigure && (
              <button onClick={() => setSettingsMode("edit")}>Settings</button>
            )}
          </div>
          {invite && (
            <input
              aria-label="Invite URL"
              readOnly
              value={invite}
              onFocus={(e) => e.currentTarget.select()}
              className="w-64 border border-ink bg-paper px-2 text-xs"
            />
          )}
          <span
            className={twMerge(
              "bg-paper px-1 before:text-[#9c7b6a] before:content-['⋅_']",
              connected && "before:text-ink",
            )}
          >
            {connected
              ? state.phase === "reveal"
                ? "evaluation"
                : state.creatorName === "The founding council"
                  ? "woo the princess~"
                  : `a new princess`
              : "connecting…"}
          </span>
          {state && (
            <span className="bg-paper px-1">
              reign {state.reign} · turn {state.turn + 1}/{TURN_COUNT}
            </span>
          )}
        </div>
      </header>
      <div
        className={twMerge(
          "grid h-full justify-end flex overflow-hidden",
          state.log.length
            ? "grid-cols-[minmax(0,1fr)_22%] gap-3"
            : "justify-items-center",
        )}
      >
        <div
          className={twMerge(
            "h-full min-h-0 w-[calc(100%-300px)] absolute left-10 top-[-130px]",
          )}
        >
          <Stage state={state} now={clock} onRename={game.rename} busy={game.busy} error={game.error} />
        </div>
        {state.log.length ? (
          <aside
            className="flex overflow-hidden border-2 border-ink bg-paper p-2 w-50 m-4 h-90"
            aria-label="Court history"
          >
            <ol className="m-0 min-h-0 list-none overflow-auto p-0">
              {state.log.length ? (
                state.log.map((entry, index) => (
                  <li
                    key={`${entry.name}:${index}`}
                    className="border-b border-ink/20 py-1"
                  >
                    {entry.name} {entry.event}
                    {entry.note && (
                      <span className="mt-0.5 block">{entry.note}</span>
                    )}
                    {entry.reply && (
                      <span className="mt-0.5 block">“{entry.reply}”</span>
                    )}
                  </li>
                ))
              ) : (
                <li className="opacity-70">Nothing yet.</li>
              )}
            </ol>
          </aside>
        ) : undefined}
      </div>
      <div className="absolute bottom-0 p-4 z-[1]">
        <Conversation
          key={`${state.turnKey}:${state.phase}:${state.speakerId ?? "court"}:${state.you?.seatId ?? "guest"}`}
          game={game}
        />
      </div>
      <footer className="absolute p-4 bottom-0 right-0">
        {state && (
          <span className="flex gap-2 flex-col text-right">
            <button
              className="bg-paper"
              onClick={() =>
                setSettingsMode((mode) => (mode === "create" ? null : "create"))
              }
            >
              {"> "}
              {settingsMode === "create"
                ? "exit private court"
                : "make private court"}
            </button>

            <button className="bg-paper" onClick={() => setLineages(true)}>
              {"> "}see past lineages
            </button>
          </span>
        )}
      </footer>
      {((state.phase === "lobby" && !state.you?.seatId) || intro) && (
        <HowToPlay
          privateLobby={!!lobbyId}
          required={state.phase === "lobby"}
          winnerSitsOut={state.winnerSitsOut}
          onCreateLobby={() => setSettingsMode("create")}
          onClose={() => {
            setIntro(false);
            if (state.phase === "lobby" || state.you?.role === "spectator")
              void game.enter();
          }}
        />
      )}
      {lineages && (
        <Lineages lobbyId={lobbyId} onClose={() => setLineages(false)} />
      )}
      {settingsMode && (
        <LobbySettings
          key={settingsMode}
          onClose={() => setSettingsMode(null)}
          initial={
            settingsMode === "edit"
              ? {
                  minPlayers: state.minPlayers,
                  maxPlayers: state.maxPlayers,
                  timersEnabled: state.timersEnabled,
                  winnerSitsOut: state.winnerSitsOut,
                }
              : undefined
          }
          onSave={settingsMode === "edit" ? game.configure : undefined}
          started={settingsMode === "edit" && state.phase !== "lobby"}
        />
      )}
    </main>
  );
}
