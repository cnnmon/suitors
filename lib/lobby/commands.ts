import { adminReset, startCourt, closeIfAdminAbsent, continueUntimed, setTimers, advance, ensureJoined, enterCourt, heartbeat, leave, LobbyError, nextPrincess, nextSpeaker, resetCourt, setName, submit, turnKey, view } from "./engine";
import { claimRound, finishRound, type Evaluation, type RoundJob } from "./round";
import { preferenceEdits } from "./preferenceEdits";
import { PREFERENCE_LIMIT, PREFERENCE_EDIT_LIMIT } from "./settings";
import type { Preferences, Room, RoomView } from "./types";

export type Command = {
  action: "start" | "configure" | "sync" | "say" | "next" | "reset" | "adminReset" | "enter" | "rename" | "create" | "leave" | "finishRound" | "finishCreation";
  phase?: string; minPlayers?: number | null; maxPlayers?: number | null; timersEnabled?: boolean;
  lobbyId?: string; capacity?: number; winnerSitsOut?: boolean;
  id: string; key?: string; text?: string; name?: string; live?: boolean; speakerId?: string;
  evaluations?: Evaluation[]; preferences?: Preferences | null;
};
export type CommandResult = {
  state: RoomView;
  evaluation?: RoundJob;
  creation?: { key: string; prompt: string };
  error?: { message: string; status: number };
};

// Runs inside one Convex transaction. AI calls happen outside the transaction.
export function execute(room: Room, command: Command, now: number): CommandResult {
  const { action, id } = command;
  const live = !!command.live;
  let result: Omit<CommandResult, "state"> = {};
  try {
    if (action === "adminReset") {
      adminReset(room, now);
      return { state: view(room, null, now) };
    }
    if (room.closedAt != null || (Object.keys(room.members).length > 0 && closeIfAdminAbsent(room, now))) return { state: view(room, id, now) };
    if (action === "sync") ensureJoined(room, id, now, command.name);
    else if (action !== "finishRound" && action !== "finishCreation") heartbeat(room, id, now);
    advance(room, now);
    // A crashed web request cannot leave a suitor waiting forever for AI.
    if (room.phase === "evaluating" && room.deadline !== null && now >= room.deadline && room.evaluation) {
      console.warn("Court evaluation exceeded its deadline; using local fallback");
      finishRound(room, room.evaluation.key, room.evaluation.owner, undefined, now);
    }
    if (!room.members[id]) throw new LobbyError("This browser is no longer at court. Refresh to rejoin.", 401);
    if (action === "configure") {
      if (room.ownerId !== id) throw new LobbyError("Only the lobby creator can change these settings.", 403);
      const capacity = command.maxPlayers !== undefined ? command.maxPlayers ?? 15 : command.capacity ?? room.capacity ?? 5;
      const minimum = command.minPlayers !== undefined ? command.minPlayers : room.minPlayers ?? null;
      if (!Number.isInteger(capacity) || capacity < 2 || capacity > 15 || (minimum !== null && (!Number.isInteger(minimum) || minimum < 1 || minimum > capacity))) throw new LobbyError("Choose a minimum of 1–15 and a maximum of 2–15, with minimum no greater than maximum.");
      if (room.phase !== "lobby" && (capacity !== room.capacity || minimum !== (room.minPlayers ?? null))) throw new LobbyError("Reset the contest to change the player limit.");
      if (room.seats.filter(s => s.owner).length > capacity) throw new LobbyError("The player limit cannot be below the number seated.");
      room.capacity = capacity;
      if (command.minPlayers !== undefined) room.minPlayers = command.minPlayers;
      if (command.maxPlayers !== undefined) room.maxPlayers = command.maxPlayers;
      if (command.timersEnabled !== undefined && command.timersEnabled !== (room.timersEnabled !== false)) setTimers(room, command.timersEnabled, now);
      if (command.winnerSitsOut !== undefined) room.winnerSitsOut = command.winnerSitsOut;
      room.revision++;
    }
    if (action === "leave") {
      const owner = room.ownerId === id;
      leave(room, id, now);
      if (owner) closeIfAdminAbsent(room, now);
      if (room.closedAt != null) return { state: view(room, id, now) };
    }
    if (action === "start") startCourt(room, id, now);
    if (action === "reset") resetCourt(room, id, now);
    if (action === "enter") enterCourt(room, id, now);
    if (action === "rename") setName(room, id, command.text, now);
    // Ignore duplicate or stale clicks from another tab viewing the same result.
    if (action === "next" && room.phase === "results" && command.key === turnKey(room) && command.speakerId === room.seats[room.speaker]?.id) nextSpeaker(room, id, now);
    if (action === "next" && command.key === turnKey(room) && command.phase === room.phase && room.timersEnabled === false) continueUntimed(room, now);
    if (action === "say") submit(room, id, command.key, command.text, now);
    if (action === "finishRound") finishRound(room, command.key!, id, command.evaluations, now);
    if (action === "create") {
      if (room.phase !== "creating" || room.winner?.memberId !== id || command.key !== turnKey(room) || (room.deadline !== null && now >= room.deadline)) throw new LobbyError("Only the winner can create this princess before the timer ends.", 403);
      if (room.creationPending) throw new LobbyError("Your princess is already being created.", 409);
      if (!command.text?.trim() || command.text.length > PREFERENCE_LIMIT) throw new LobbyError(`Use 1–${PREFERENCE_LIMIT} characters.`);
      const edits = preferenceEdits(room.preferences.prompt, command.text);
      if (edits > PREFERENCE_EDIT_LIMIT) throw new LobbyError(`That changes ${edits} characters. You can change at most ${PREFERENCE_EDIT_LIMIT}.`);
      room.creationPending = true;
      room.creationId = `${turnKey(room)}:${room.revision + 1}`;
      room.revision++;
      result.creation = { key: room.creationId, prompt: command.text.trim() };
    }
    if (action === "finishCreation") {
      if (room.creationId !== command.key || room.winner?.memberId !== id) throw new LobbyError("The next princess has already arrived.", 409);
      room.creationPending = false; room.creationId = null; room.revision++;
      if (!command.preferences) throw new LobbyError("Try a clear preference, e.g. ‘Likes humor. Hates flattery.’", 422);
      nextPrincess(room, command.preferences, now);
    }
    const job = claimRound(room, id, now, live);
    if (job) result.evaluation = job;
  } catch (error) {
    if (!(error instanceof LobbyError)) throw error;
    result = { error: { message: error.message, status: error.status } };
  }
  return { state: view(room, id, now), ...result };
}
