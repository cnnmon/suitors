import { npcText, scriptedDialogue, textFeatures } from "./dialogue";
import { turnKey } from "./engine";
import { questionFor } from "./prompts";
import type { Preferences, Room } from "./types";

export type Evaluation = { seatId: string; text: string; reply: string; feedback: string; score: number };
export type RoundJob = { key: string; question: string; preferences: Preferences; lastRevealedPreference: string | null; suitors: Array<{ seatId: string; name: string; npc: boolean; voice: string; text: string; timedOut: boolean }> };
const voices = ["playful", "gentle", "bold", "surreal", "skeptical"];
export const EVALUATION_MS = 40_000;
export function shortText(text: string, characters: number, words: number) {
  const short = text.trim().split(/\s+/).slice(0, words).join(" ");
  return short.length <= characters ? short : short.slice(0, characters - 1).replace(/\s+\S*$/, "") + "…";
}

// Called inside the Convex mutation: the phase change is the single job claim.
export function claimRound(room: Room, owner: string, now: number, live: boolean): RoundJob | undefined {
  if (room.phase !== "dialogue" || room.seats.some(s => s.owner && !room.submissions[s.id])) return;
  for (const [index, seat] of room.seats.entries()) {
    if (!room.submissions[seat.id]) {
      const text = npcText(index, room.turn, room.reign);
      room.submissions[seat.id] = { ...scriptedDialogue(text, room.preferences, room.turn), text, by: null, pending: true, mode: "scripted", timedOut: false, at: now };
    }
    room.submissions[seat.id].pending = true;
  }
  room.phase = "evaluating";
  room.deadline = now + EVALUATION_MS;
  room.evaluation = { owner, key: turnKey(room) };
  room.revision++;
  const job: RoundJob = { key: turnKey(room), question: questionFor(room.reign, room.turn).question,
    lastRevealedPreference: room.lastRevealedPreference ?? null,
    preferences: structuredClone(room.preferences), suitors: room.seats.map((seat, index) => ({
      seatId: seat.id, name: seat.name, npc: room.submissions[seat.id].by === null,
      voice: voices[index % voices.length], text: room.submissions[seat.id].text, timedOut: room.submissions[seat.id].timedOut,
    })) };
  if (!live) { finishRound(room, job.key, owner, undefined, now); return; }
  return job;
}

export function finishRound(room: Room, key: string, owner: string, evaluations: Evaluation[] | undefined, now: number) {
  if (room.phase !== "evaluating" || room.evaluation?.key !== key || room.evaluation.owner !== owner || turnKey(room) !== key) return;
  // Incomplete/duplicate model output falls back for the whole court, with no retry call.
  const valid = evaluations?.length === room.seats.length && new Set(evaluations.map(e => e.seatId)).size === room.seats.length &&
    room.seats.every(s => evaluations.some(e => e.seatId === s.id && Number.isFinite(e.score) && e.reply.trim() && e.feedback.trim() && (room.submissions[s.id].by !== null || e.text.trim())));
  for (const seat of room.seats) {
    const entry = room.submissions[seat.id];
    const answer = valid ? evaluations!.find(e => e.seatId === seat.id) : undefined;
    // The model never rewrites a human answer or invents one for a timeout.
    const text = entry.by === null && answer ? shortText(answer.text, 100, 16) : entry.text;
    const fallback = scriptedDialogue(text, room.preferences, room.turn);
    Object.assign(entry, {
      text, features: textFeatures(text), score: entry.timedOut ? 0 : answer ? Math.max(0, Math.min(99, Math.round(answer.score))) : fallback.score,
      reply: shortText(entry.timedOut ? "Your moment slipped away." : answer?.reply || fallback.reply, 80, 12),
      feedback: shortText(entry.timedOut ? "No answer." : answer?.feedback || fallback.feedback, 48, 6),
      pending: false, mode: answer ? "live" : "scripted", at: now,
    });
  }
  room.phase = "results"; room.speaker = 0; room.deadline = null; room.evaluation = null; room.revision++;
}
