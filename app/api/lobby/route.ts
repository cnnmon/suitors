import { createHash, randomBytes, randomUUID } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { evaluateRound, interpret } from "@/lib/lobby/ai";
import { LobbyError } from "@/lib/lobby/engine";
import { dispatch } from "@/lib/lobby/store";
import type { Command, CommandResult } from "@/lib/lobby/commands";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
const cookieName = "suitors-session";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
function session(request: NextRequest) {
  const existing = request.cookies.get(cookieName)?.value;
  return existing && /^[a-f0-9]{64}$/.test(existing) ? existing : randomBytes(32).toString("hex");
}
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
function respond(result: CommandResult, token: string, request: NextRequest) {
  const response = result.error ? json({ error: result.error.message }, result.error.status) : json(result.state);
  response.cookies.set(cookieName, token, { httpOnly: true, sameSite: "strict", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
function schedule(result: CommandResult, id: string, lobbyId?: string) {
  const job = result.evaluation;
  if (!job || result.error) return;
  after(async () => {
    try {
      const evaluations = await evaluateRound(job);
      await dispatch({ action: "finishRound", lobbyId, id, key: job.key, ...(evaluations ? { evaluations } : {}) });
    } catch (error) {
      console.error("Princess dialogue failed", error);
      await dispatch({ action: "finishRound", lobbyId, id, key: job.key }).catch(() => undefined);
    }
  });
}
function requestedLobby(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("lobby") || undefined;
  if (id && !/^[a-zA-Z0-9-]{8,64}$/.test(id)) throw new LobbyError("Invalid lobby URL.");
  return id;
}
function errorResponse(error: unknown) {
  if (error instanceof LobbyError) return json({ error: error.message }, error.status);
  console.error("Lobby request failed", error);
  return json({ error: "The court is reconnecting..." }, 503);
}
export async function GET(request: NextRequest) {
  try {
    const token = session(request);
    const id = hash(token);
    const result = await dispatch({ action: "sync", id, lobbyId: requestedLobby(request), live: !!process.env.OPENAI_API_KEY });
    schedule(result, id, requestedLobby(request));
    return respond(result, token, request);
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    const expectedOrigin = `${request.nextUrl.protocol}//${request.headers.get("host") || request.nextUrl.host}`;
    if (origin && origin !== expectedOrigin) throw new LobbyError("Join from the game page.", 403);
    const raw = await request.text();
    if (raw.length > 2000) throw new LobbyError("That message is too long.", 413);
    let body: { action?: unknown; text?: unknown; turnKey?: unknown; speakerId?: unknown; capacity?: unknown; winnerSitsOut?: unknown; minPlayers?: unknown; maxPlayers?: unknown; timersEnabled?: unknown; phase?: unknown };
    try { body = JSON.parse(raw); } catch { throw new LobbyError("Invalid request."); }
    if (!body || typeof body !== "object" || !["newLobby", "configure", "say", "next", "reset", "enter", "create"].includes(String(body.action))) throw new LobbyError("Unknown action.");
    if (body.text !== undefined && typeof body.text !== "string") throw new LobbyError("Invalid answer.");
    if (body.turnKey !== undefined && typeof body.turnKey !== "string") throw new LobbyError("Invalid turn.");
    if (body.speakerId !== undefined && typeof body.speakerId !== "string") throw new LobbyError("Invalid result.");
    const token = session(request);
    const id = hash(token);
    if (body.capacity !== undefined && (typeof body.capacity !== "number" || !Number.isInteger(body.capacity) || body.capacity < 2 || body.capacity > 15)) throw new LobbyError("Choose 2–15 players.");
    if (body.winnerSitsOut !== undefined && typeof body.winnerSitsOut !== "boolean") throw new LobbyError("Invalid winner setting.");
    if (body.phase !== undefined && typeof body.phase !== "string") throw new LobbyError("Invalid phase.");
    if (body.timersEnabled !== undefined && typeof body.timersEnabled !== "boolean") throw new LobbyError("Invalid timers setting.");
    for (const field of ["minPlayers", "maxPlayers"] as const) {
      const value = body[field];
      if (value !== undefined && value !== null && (typeof value !== "number" || !Number.isInteger(value) || value < (field === "minPlayers" ? 1 : 2) || value > 15)) throw new LobbyError("Invalid player limits.");
    }
    if (typeof body.minPlayers === "number" && body.minPlayers > (typeof body.maxPlayers === "number" ? body.maxPlayers : typeof body.capacity === "number" ? body.capacity : 15)) throw new LobbyError("Minimum cannot exceed maximum.");
    const settings = {
      ...(body.minPlayers === null || typeof body.minPlayers === "number" ? { minPlayers: body.minPlayers } : {}),
      ...(body.maxPlayers === null || typeof body.maxPlayers === "number" ? { maxPlayers: body.maxPlayers } : {}),
      ...(typeof body.timersEnabled === "boolean" ? { timersEnabled: body.timersEnabled } : {}),
    };
    if (body.action === "newLobby") {
      const lobbyId = randomUUID();
      const created = await dispatch({ ...settings, action: "sync", id, lobbyId, ...(typeof body.capacity === "number" ? { capacity: body.capacity } : {}), winnerSitsOut: body.winnerSitsOut === true });
      const response = json({ url: `/l/${lobbyId}` });
      const cookie = respond(created, token, request).headers.get("set-cookie");
      if (cookie) response.headers.set("set-cookie", cookie);
      return response;
    }
    const command: Command = { ...settings, action: body.action as Command["action"], id, lobbyId: requestedLobby(request), live: !!process.env.OPENAI_API_KEY };
    if (typeof body.phase === "string") command.phase = body.phase;
    if (typeof body.capacity === "number") command.capacity = body.capacity;
    if (typeof body.winnerSitsOut === "boolean") command.winnerSitsOut = body.winnerSitsOut;
    if (typeof body.text === "string") command.text = body.text;
    if (typeof body.turnKey === "string") command.key = body.turnKey;
    if (typeof body.speakerId === "string") command.speakerId = body.speakerId;
    let result = await dispatch(command);
    if (result.creation && !result.error) {
      const c = result.creation;
      result = await dispatch({ action: "finishCreation", lobbyId: requestedLobby(request), id, key: c.key, preferences: await interpret(c.prompt), live: !!process.env.OPENAI_API_KEY });
    }
    schedule(result, id, requestedLobby(request));
    return respond(result, token, request);
  } catch (error) { return errorResponse(error); }
}
