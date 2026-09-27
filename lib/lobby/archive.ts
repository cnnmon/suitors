import { likedScore } from "./engine";
import { questionFor } from "./prompts";
import type { Room } from "./types";

// A round is one question answered by the court; a reign contains three rounds.
export function roundRecord(room: Room, now: number, reset = false) {
  const completed = room.history.length > room.turn;
  return {
    key: `${room.id}:${room.reign}:${room.turn}`, gameId: room.id, reign: room.reign, turn: room.turn + 1,
    question: questionFor(room.reign, room.turn).question, preferences: structuredClone(room.preferences),
    phase: room.phase, status: completed ? "completed" as const : reset ? "reset" as const : "active" as const,
    startedAt: room.turnStartedAt, updatedAt: now, seats: structuredClone(room.seats), answers: structuredClone(room.submissions),
    scoreEvolution: room.seats.map(seat => {
      const entry = room.submissions[seat.id];
      const score = entry && !entry.pending ? entry.score : null;
      const before = seat.total - (completed ? score ?? 0 : 0);
      const prior = room.history.slice(0, room.turn).map(turn => turn[seat.id]?.score ?? 0);
      return { seatId: seat.id, name: seat.name, memberId: seat.owner, before, roundScore: score, after: before + (score ?? 0),
        likedBefore: likedScore(prior), likedAfter: likedScore(score === null ? prior : [...prior, score]) };
    }),
  };
}
export function reignRecord(room: Room, now: number, reset = false) {
  return { key: `${room.id}:${room.reign}`, gameId: room.id, reign: room.reign, preferences: structuredClone(room.preferences),
    creator: room.creator, winner: room.winner, status: room.winner ? "completed" as const : reset ? "reset" as const : "active" as const, updatedAt: now };
}
