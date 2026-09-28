import { NextRequest, NextResponse } from "next/server";
import { LobbyError } from "@/lib/lobby/engine";
import { courtFailure } from "@/lib/lobby/failure";
import { dispatch } from "@/lib/lobby/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    const expectedOrigin = `${request.nextUrl.protocol}//${request.headers.get("host") || request.nextUrl.host}`;
    if (origin && origin !== expectedOrigin) throw new LobbyError("Open the admin page on this site.", 403);
    const raw = await request.text();
    if (raw.length > 200) throw new LobbyError("Invalid request.", 413);
    let body: { password?: unknown; action?: unknown };
    try { body = JSON.parse(raw); } catch { throw new LobbyError("Invalid request."); }
    const password = process.env.ADMIN_PASSWORD;
    if (!password) throw new LobbyError("ADMIN_PASSWORD is not set.", 503);
    if (body?.password !== password) throw new LobbyError("Wrong password.", 401);
    if (body.action !== "reset") throw new LobbyError("Unknown action.");
    const result = await dispatch({ action: "adminReset", id: "admin" });
    if (result.error) return json({ error: result.error.message }, result.error.status);
    return json({ ok: true, humans: result.state.humanCount, phase: result.state.phase, reign: result.state.reign, turn: result.state.turn });
  } catch (error) {
    if (error instanceof LobbyError) return json({ error: error.message }, error.status);
    console.error("Admin reset failed", error);
    return json({ error: courtFailure(error) }, 503);
  }
}
