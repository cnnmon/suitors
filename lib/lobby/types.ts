export const TRAITS = ["vulnerability", "humor", "boldness", "novelty", "agreement", "contrarianism", "confidence", "guarded"] as const;
export type Features = Record<(typeof TRAITS)[number], number>;
export type Preferences = { prompt: string; weights: Features; source: "scripted" | "assisted" | "npc" };

export type LobbyPhase = "lobby" | "dialogue" | "evaluating" | "results" | "feedback" | "reveal" | "creating";
export type Submission = {
  text: string; reply: string; feedback: string; score: number; features: Features;
  by: string | null; mode: "live" | "scripted"; pending: boolean; timedOut: boolean; at: number;
};
export type Seat = { id: string; npcName: string; name: string; owner: string | null; total: number };
export type Member = { name: string; lastSeen: number; joinedAt: number; seatId: string | null; misses?: number; entered?: boolean };
export type Winner = { seatId: string; name: string; memberId: string | null; total: number };
export type Room = {
  version: 1; id: string; revision: number; reign: number; turn: number; phase: LobbyPhase; speaker: number;
  deadline: number | null; turnStartedAt: number; seats: Seat[]; members: Record<string, Member>;
  preferences: Preferences; creator: { name: string; memberId: string | null };
  winner: Winner | null; submissions: Record<string, Submission>;
  history: Array<Record<string, Submission>>;
  creationPending: boolean; creationId: string | null;
  pausedAt?: number | null;
  evaluation?: { owner: string; key: string } | null;
};
export type RoomView = {
  id: string; revision: number; reign: number; turn: number; phase: LobbyPhase;
  deadline: number | null; serverNow: number; turnKey: string;
  seats: Array<{ id: string; name: string; kind: "human" | "npc"; total: number; liked: number; submitted: boolean; lastScore: number | null; line: string | null; mark: number | null; spokenAt: number | null; note: string | null }>;
  you: { name: string; seatId: string | null; role: "suitor" | "spectator"; submitted: boolean; dialogue: Pick<Submission, "text" | "reply" | "feedback" | "pending" | "mode" | "timedOut"> | null } | null;
  speakerId: string | null; reply: string | null; thinking: boolean;
  log: Array<{ name: string; event: string; note: string | null; reply: string | null }>;
  creatorName: string; winner: { seatId: string; name: string; total: number } | null;
  prompt: string; revealedPreference: string | null; canCreate: boolean; creationPending: boolean; humanCount: number;
};
