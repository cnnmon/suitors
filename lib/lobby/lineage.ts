// Public record of finished reigns. Weights and player ids stay on the server.
export type Lineage = {
  reign: number;
  preference: string;
  winner: string | null;
  said: Array<{ question: string; text: string }>;
};

type ReignSource = {
  reign: number;
  status: "active" | "completed" | "reset";
  preferences: { prompt: string };
  winner: { seatId: string; name: string } | null;
};
type RoundSource = {
  reign: number;
  turn: number;
  status: "active" | "completed" | "reset";
  question: string;
  answers: Record<string, { text: string } | undefined>;
};

export function lineagesFrom(reigns: ReignSource[], rounds: RoundSource[]): Lineage[] {
  return reigns
    .filter(reign => reign.winner && reign.status !== "reset")
    .sort((a, b) => b.reign - a.reign)
    .map(reign => {
      const seatId = reign.winner!.seatId;
      const said = rounds
        .filter(round => round.reign === reign.reign && round.status === "completed")
        .sort((a, b) => a.turn - b.turn)
        .flatMap(round => {
          const text = round.answers[seatId]?.text?.trim();
          return text ? [{ question: round.question, text }] : [];
        });
      return { reign: reign.reign, preference: reign.preferences.prompt, winner: reign.winner!.name, said };
    });
}
