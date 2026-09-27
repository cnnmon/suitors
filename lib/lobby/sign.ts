import type { RoomView } from "./types";

// The selected result is the only source of truth. No separate scorecard timer.
export function responseSign(seats: RoomView["seats"], speakerId: string | null) {
  const seat = seats.find(s => s.id === speakerId);
  return seat && seat.mark !== null
    ? { name: seat.name, mark: seat.mark, note: seat.note || "" }
    : null;
}
