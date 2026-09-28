"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { twMerge } from "tailwind-merge";
import { Quote } from "./Quote";
import { responseSign } from "@/lib/lobby/sign";
import { NAME_LIMIT } from "@/lib/lobby/settings";
import type { RoomView } from "@/lib/lobby/types";

const spring = { type: "spring" as const, stiffness: 160, damping: 22 };
const pixel = "[image-rendering:pixelated]";

function Sign({
  mark,
  className,
  label,
}: {
  mark: number;
  className: string;
  label: string;
}) {
  return (
    <div
      className={twMerge("relative pointer-events-none", className)}
      aria-label={label}
    >
      <img
        className={twMerge("block h-auto w-full", pixel)}
        src="/art/sign.png"
        alt=""
        width={48}
        height={32}
      />
      <strong className="absolute inset-x-[14%] top-[16%] bottom-[20%] flex items-center justify-center leading-none text-ink">
        {mark}
        <span className="text-[0.5em]">/10</span>
      </strong>
    </div>
  );
}

export function Stage({ state, now, onRename, busy = false, error = "" }: { state: RoomView; now: number; onRename?: (name: string) => Promise<boolean>; busy?: boolean; error?: string }) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(state.you?.name ?? "");
  const sign = responseSign(
    state.seats,
    state.phase === "results" ? state.speakerId : null,
  );
  const remaining = state.deadline
    ? Math.max(0, Math.ceil((state.deadline - now) / 1000))
    : null;
  const princessQuote =
    sign?.note ||
    state.reply ||
    (state.thinking &&
      state.seats.some((seat) => seat.id === state.speakerId && seat.line));
  const spread = state.seats.some((seat) => seat.line);
  const picked = state.winner;
  const seats = [...state.seats].sort(
    (a, b) =>
      Number(b.id === state.you?.seatId) - Number(a.id === state.you?.seatId),
  );
  const last = seats.length - 1;
  const dense = seats.length > 5;

  if (picked) {
    return (
      <section
        className="grid h-full place-items-center absolute top-30 right-30"
        aria-label="The shared court"
      >
        <div className="grid justify-items-center gap-3">
          <p className="m-0 text-center font-display text-2xl uppercase">
            {picked.name} wins.
            <br />A new princess is born
          </p>
          <img
            className={twMerge("block h-auto w-80", pixel)}
            src="/art/win.gif"
            width={137}
            height={136}
            alt={`${picked.name} and the princess`}
          />
        </div>
      </section>
    );
  }

  return (
    <section
      className="grid h-full w-full min-h-0"
      aria-label="The shared court"
    >
      <div className="grid items-end gap-2 grid-cols-[minmax(0,1fr)_22%]">
        <motion.div
          className="grid h-full w-full min-w-0 items-end justify-self-center"
          style={{
            gridTemplateColumns: `repeat(${Math.min(5, state.seats.length)}, minmax(0, 1fr))`,
            height: dense ? "auto" : undefined,
            rowGap: dense ? 12 : undefined,
          }}
          initial={false}
          animate={{ maxWidth: spread || dense ? "100%" : "62%" }}
          transition={spring}
        >
          {seats.map((seat, index) => {
            const yours = state.you?.seatId === seat.id;
            const up = state.speakerId === seat.id && !!seat.line;
            const thinking =
              state.thinking && state.speakerId === seat.id && !seat.line;
            return (
              <div
                key={seat.id}
                className="flex h-full min-w-0 flex-col items-center justify-end px-0.5"
              >
                <div className="relative flex w-full flex-col items-center">
                  {(up || thinking) && (
                    <Quote
                      long
                      className="absolute bottom-full left-1/2 z-30 w-40 -translate-x-[56%] translate-y-[8%] text-sm"
                      text={thinking ? "…" : seat.line!}
                      label={
                        thinking
                          ? `${seat.name} is thinking`
                          : `${seat.name} says ${seat.line}`
                      }
                    />
                  )}
                  <div
                    className="relative z-[1] h-3.5 w-full border-2 border-ink bg-[#fff7fc]"
                    role="img"
                    aria-label={`${seat.name} is liked ${seat.liked} out of 100`}
                    title={`${seat.liked} / 100, later turns count more`}
                  >
                    <div
                      className={twMerge(
                        "h-full transition-[width] duration-700 ease-out",
                        seat.liked > 50 ? "bg-[#1f9d4a]" : "bg-orange",
                      )}
                      style={{ width: `${seat.liked}%` }}
                    />
                  </div>
                  <div
                    className={
                      dense
                        ? "relative flex h-20 w-20"
                        : "relative h-50 flex w-50"
                    }
                    style={{
                      zIndex: index + 1,
                    }}
                  >
                    <img
                      className={twMerge(
                        "absolute bottom-0 block h-50 w-auto max-w-none select-none",
                        pixel,
                        dense && "h-20",
                        index === 0
                          ? "left-0"
                          : index === last
                            ? "right-0"
                            : "left-1/2 -translate-x-1/2",
                      )}
                      src="/art/suitor.gif"
                      width={200}
                      height={200}
                      alt={`${seat.name}, ${seat.kind === "npc" ? "NPC" : "human"} suitor`}
                    />
                  </div>
                </div>
                <div
                  className={twMerge(
                    "relative z-[1] rounded-lg mt-1 max-w-40 min-w-0 border border-ink bg-paper px-1 py-0.5 text-center",
                    dense && "w-full text-[10px]",
                    yours && "bg-ink text-paper",
                    up && "border-orange",
                  )}
                  title={`${seat.name}, ${seat.total} points`}
                >
                  {yours && renaming && onRename ? (
                    <form
                      className="flex min-w-0 flex-col items-stretch gap-1"
                      onSubmit={e => {
                        e.preventDefault();
                        void onRename(draft).then(ok => { if (ok) setRenaming(false); });
                      }}
                    >
                      <input
                        aria-label="Your name"
                        className="min-w-0 flex-1 border border-ink bg-[#fff7fc] px-1 text-ink"
                        value={draft}
                        maxLength={NAME_LIMIT}
                        autoFocus
                        disabled={busy}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Escape") setRenaming(false);
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void onRename(draft).then(ok => { if (ok) setRenaming(false); });
                          }
                        }}
                      />
                      {error && (
                        <span role="alert">{error}</span>
                      )}
                    </form>
                  ) : (
                    <span className="flex min-w-0 items-center justify-center gap-1">
                      <strong className="min-w-0 truncate">
                        {seat.name}
                        {yours ? " (You)" : seat.kind === "npc" ? " (NPC)" : ""}
                      </strong>
                      {yours && onRename && (
                        <button
                          type="button"
                          className="shrink-0"
                          aria-label="Change your name"
                          disabled={busy}
                          onClick={() => { setDraft(seat.name); setRenaming(true); }}
                        >
                          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                            <path fill="currentColor" d="M11.6 1.4a1.4 1.4 0 0 1 2 2L5.5 11.5 2 12.8l1.3-3.5 8.3-7.9zM3.7 10.2 3.1 12l1.8-.6 7.6-7.6-1.2-1.2-7.6 7.6z" />
                          </svg>
                        </button>
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </motion.div>
        <div className="relative h-full min-h-0 w-full absolute top-[-80px]">
          <img
            className={twMerge(
              "pointer-events-none absolute bottom-[0] left-[-50px] z-[1] h-30 w-auto max-w-none",
              pixel,
            )}
            src="/art/kitty.png"
            alt="The court cat"
            width={100}
            height={100}
          />
          <img
            className={twMerge(
              "pointer-events-none absolute bottom-0 left-1/2 z-[1] h-70 w-auto max-w-none -translate-x-1/2",
              pixel,
            )}
            src="/art/throne.png"
            alt=""
            width={160}
            height={292}
          />
          <div className="absolute bottom-0 left-1/2 z-[2] h-60 w-auto -translate-x-1/2">
            <img
              className={twMerge(
                "relative block h-full w-auto max-w-none",
                pixel,
              )}
              src="/art/princess-sit.gif"
              width={220}
              height={220}
              alt="The princess on her throne"
            />
            {remaining !== null && !princessQuote && (
              <strong
                className={twMerge(
                  "absolute left-1/2 top-[-80px] z-[6] -translate-x-1/2 bg-paper px-1 text-[28px] leading-none",
                  remaining <= 5 && "text-[#b73b0c]",
                )}
                aria-label={`${remaining} seconds remaining`}
              >
                {remaining}s
              </strong>
            )}
            {princessQuote && (
              <Quote
                className="absolute left-1/2 top-[-120px] z-[5] w-40 -translate-x-1/2 text-sm"
                text={sign?.note || state.reply || "…"}
                long
                label={
                  sign?.note
                    ? `The princess says ${sign.note}`
                    : state.reply
                      ? `The princess says ${state.reply}`
                      : "The princess is thinking"
                }
              />
            )}
            {sign && (
              <div
                key={`${state.turnKey}:${state.speakerId}`}
                className="pointer-events-none absolute top-[38%] left-1/2 z-[4] w-[46%] origin-center -translate-x-1/2 animate-sign-pop"
              >
                <Sign
                  mark={sign.mark}
                  className="w-full"
                  label={`${sign.name}, ${sign.mark} out of 10`}
                />
                <em className="mt-px block border border-ink bg-[#fff7fc] px-1 text-center not-italic">
                  {sign.name}
                </em>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
