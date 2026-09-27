import { createHash, randomBytes } from "node:crypto";
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
function schedule(result: CommandResult, id: string) {
  const job = result.evaluation;
  if (!job || result.error) return;
  after(async () => {
    try {
      const evaluations = await evaluateRound(job);
      await dispatch({ action: "finishRound", id, key: job.key, ...(evaluations ? { evaluations } : {}) });
    } catch (error) {
      console.error("Princess dialogue failed", error);
      await dispatch({ action: "finishRound", id, key: job.key }).catch(() => undefined);
    }
  });
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
    const result = await dispatch({ action: "sync", id, live: !!process.env.OPENAI_API_KEY });
    schedule(result, id);
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
    let body: { action?: unknown; text?: unknown; turnKey?: unknown; speakerId?: unknown };
    try { body = JSON.parse(raw); } catch { throw new LobbyError("Invalid request."); }
    if (!body || typeof body !== "object" || !["say", "next", "reset", "enter", "create"].includes(String(body.action))) throw new LobbyError("Unknown action.");
    if (body.text !== undefined && typeof body.text !== "string") throw new LobbyError("Invalid answer.");
    if (body.turnKey !== undefined && typeof body.turnKey !== "string") throw new LobbyError("Invalid turn.");
    if (body.speakerId !== undefined && typeof body.speakerId !== "string") throw new LobbyError("Invalid result.");
    const token = session(request);
    const id = hash(token);
    const command: Command = { action: body.action as Command["action"], id, live: !!process.env.OPENAI_API_KEY };
    if (typeof body.text === "string") command.text = body.text;
    if (typeof body.turnKey === "string") command.key = body.turnKey;
    if (typeof body.speakerId === "string") command.speakerId = body.speakerId;
    let result = await dispatch(command);
    if (result.creation && !result.error) {
      const c = result.creation;
      result = await dispatch({ action: "finishCreation", id, key: c.key, preferences: await interpret(c.prompt), live: !!process.env.OPENAI_API_KEY });
    }
    schedule(result, id);
    return respond(result, token, request);
  } catch (error) { return errorResponse(error); }
}
