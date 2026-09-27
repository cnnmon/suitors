/// <reference types="vite/client" />
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { createRoom } from "../lib/lobby/engine";
import { FEEDBACK_MS, REVEAL_MS, TURN_COUNT } from "../lib/lobby/settings";
import type { Command } from "../lib/lobby/commands";

const background = vi.hoisted(() => [] as Array<() => Promise<void>>);
vi.mock("next/server", async importOriginal => ({
  ...await importOriginal<typeof import("next/server")>(),
  after: (work: () => Promise<void>) => background.push(work),
}));
const modules = import.meta.glob("../convex/**/*.ts");
const secret = "test-server-secret";
const makeDatabase = () => convexTest(schema, modules);
let db: ReturnType<typeof makeDatabase>;
let now: number;
const send = (command: Command) => db.mutation(api.court.dispatch, { secret, command });
const sync = async (id = "player") => {
  const state = (await send({ action: "sync", id })).state;
  return state.phase === "lobby" ? (await send({ action: "enter", id })).state : state;
};
vi.mock("../lib/lobby/store", () => ({ dispatch: (command: Command) => send(command) }));
beforeEach(() => {
  vi.stubEnv("SUITORS_SERVER_SECRET", secret);
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.useFakeTimers(); now = 1_000_000; vi.setSystemTime(now);
  db = makeDatabase();
  background.length = 0;
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const wait = (ms: number) => { now += ms; vi.setSystemTime(now); };

test("full game archives answers, evaluations and score evolution across succession and reset", async () => {
  let state = await sync();
  const gameId = state.id;
  const name = state.you!.name;
  expect(state.you?.submitted).toBe(false);
  expect(state.you?.role).toBe("suitor");
  expect((await sync()).you?.name).toBe(name);
  for (let turn = 0; turn < TURN_COUNT; turn++) {
    expect(state.turn).toBe(turn);
    const result = await send({ action: "say", id: "player", key: state.turnKey, text: "Imagine a new, unusual moon that tells a funny joke. Honestly, I feel nervous asking." });
    expect(result.error).toBeUndefined();
    state = result.state;
    for (let seat = 0; seat < state.seats.length; seat++) state = (await send({ action: "next", id: "player", key: state.turnKey, speakerId: state.speakerId! })).state;
    expect(state.phase).toBe("feedback");
    const saved = await db.query(api.court.history, { secret, gameId });
    expect(saved.rounds).toHaveLength(turn + 1);
    const round = saved.rounds[turn];
    expect(round.status).toBe("completed");
    expect(Object.keys(round.answers)).toHaveLength(state.seats.length);
    expect(round.preferences.prompt).toBeTruthy();
    for (const score of round.scoreEvolution) {
      expect(score.after).toBe(score.before + score.roundScore!);
      expect(round.answers[score.seatId].reply).toBeTruthy();
      expect(round.answers[score.seatId].feedback).toBeTruthy();
      if (turn > 0) expect(score.before).toBe(saved.rounds[turn - 1].scoreEvolution.find(s => s.seatId === score.seatId)!.after);
    }
    expect(state.revealedPreference).toBeNull();
    wait(FEEDBACK_MS); state = await sync();
  }
  expect(state.phase).toBe("reveal");
  expect(state.winner?.name).toBe(name);
  const historyBefore = await db.query(api.court.history, { secret, gameId });
  wait(REVEAL_MS); state = await sync();
  const rejected = await send({ action: "create", id: "player", key: state.turnKey, text: "Likes quiet confidence." });
  expect(rejected.error?.message).toContain("at most 20");
  const revisedPrompt = state.revealedPreference!.replace("Likes humor", "Hates humor");
  const prepared = await send({ action: "create", id: "player", key: state.turnKey, text: revisedPrompt });
  expect(prepared.creation).toBeDefined();
  const weights = { vulnerability: 2, humor: -2, boldness: 0, novelty: 2, agreement: -2, contrarianism: 0, confidence: 0, guarded: 0 };
  state = (await send({ action: "finishCreation", id: "player", key: prepared.creation!.key, preferences: { prompt: prepared.creation!.prompt, weights, source: "scripted" } })).state;
  expect(state.reign).toBe(2);
  expect(state.you?.role).toBe("suitor");
  expect(state.you?.name).not.toBe(name);
  expect(state.you?.submitted).toBe(false);
  const newName = state.you?.name;
  expect((await sync()).you?.name).toBe(newName);
  expect(state.revealedPreference).toBeNull();
  const after = await db.query(api.court.history, { secret, gameId });
  expect(after.reigns).toHaveLength(2);
  expect(after.rounds.slice(0, TURN_COUNT)).toEqual(historyBefore.rounds);
  expect(after.rounds[TURN_COUNT].preferences.prompt).toBe(revisedPrompt);
  const lines = await db.query(api.court.lineages, { secret });
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatchObject({ reign: 1, winner: name });
  expect(lines[0].said).toHaveLength(TURN_COUNT);
  expect(lines[0].said[0].text).toContain("unusual moon");
  expect(JSON.stringify(lines)).not.toContain(revisedPrompt);
  expect(JSON.stringify(lines)).not.toContain("weights");
  await send({ action: "reset", id: "player" });
  const archived = await db.query(api.court.history, { secret, gameId });
  expect(archived.rounds.slice(0, TURN_COUNT)).toEqual(historyBefore.rounds);
  expect(archived.rounds[TURN_COUNT].status).toBe("reset");
});

test("private records require the server secret; browser views hide preferences", async () => {
  const state = await sync();
  expect(JSON.stringify(state)).not.toContain("Likes humor, original ideas");
  expect(JSON.stringify(state)).not.toContain('"weights"');
  await expect(db.query(api.court.history, { secret: "wrong", gameId: state.id })).rejects.toThrow("Unauthorized");
  await expect(db.query(api.court.lineages, { secret: "wrong" })).rejects.toThrow("Unauthorized");
  await expect(db.mutation(api.court.dispatch, { secret: "wrong", command: { action: "sync", id: "intruder" } })).rejects.toThrow("Unauthorized");
});

test("pending and completed AI evaluations are saved without double counting", async () => {
  const state = await sync();
  const prepared = await send({ action: "say", id: "player", key: state.turnKey, text: "A pocket moon.", live: true });
  const seatId = state.you!.seatId!;
  const evaluations = prepared.evaluation!.suitors.map(s => ({ seatId: s.seatId, text: s.text, reply: "Keep it somewhere warm.", feedback: "Original.", score: 81 }));
  let record = (await db.query(api.court.history, { secret, gameId: state.id })).rounds[0];
  expect(record.answers[seatId].pending).toBe(true);
  expect(record.scoreEvolution[0].roundScore).toBeNull();
  await send({ action: "finishRound", id: "player", key: state.turnKey, evaluations });
  await send({ action: "finishRound", id: "player", key: state.turnKey, evaluations: evaluations.map(e => ({ ...e, score: 99 })) });
  record = (await db.query(api.court.history, { secret, gameId: state.id })).rounds[0];
  expect(record.answers[seatId]).toMatchObject({ reply: "Keep it somewhere warm.", score: 81, pending: false, mode: "live" });
  expect(record.scoreEvolution[0].after).toBe(81);
});

test("separate browser sessions share one lobby and keep their own names and seats", async () => {
  const first = await sync("one");
  const second = await sync("two");
  expect(second.id).toBe(first.id);
  expect(second.you?.name).not.toBe(first.you?.name);
  expect(second.you?.seatId).not.toBe(first.you?.seatId);
  expect((await sync("one")).you?.seatId).toBe(first.you?.seatId);
  expect(await db.run(ctx => ctx.db.query("lobbies").collect())).toHaveLength(1);
});

test("GET assigns a name before answering; cookie refresh preserves it", async () => {
  const { NextRequest } = await import("next/server");
  const { GET, POST } = await import("../app/api/lobby/route");
  const url = "http://localhost:3107/api/lobby";
  const response = await GET(new NextRequest(url));
  expect(response.status).toBe(200);
  const state = await response.json();
  expect(state.you.name).toMatch(/^[A-Z][a-z]+$/);
  expect(state.you.submitted).toBe(false);
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  const refreshed = await (await GET(new NextRequest(url, { headers: { cookie } }))).json();
  expect(refreshed.you.name).toBe(state.you.name);
  await POST(new NextRequest(url, { method: "POST", headers: { cookie, origin: "http://127.0.0.1:3107", host: "127.0.0.1:3107" }, body: JSON.stringify({ action: "enter" }) }));
  const post = (origin: string) => POST(new NextRequest(url, { method: "POST", headers: { cookie, origin, host: "127.0.0.1:3107" }, body: JSON.stringify({ action: "say", text: "A tiny moon.", turnKey: state.turnKey }) }));
  expect((await post("https://elsewhere.example")).status).toBe(403);
  const answered = await (await post("http://127.0.0.1:3107")).json();
  expect(answered.you.dialogue.text).toBe("A tiny moon.");
  expect(answered.you.name).toBe(state.you.name);
});

test("legacy import is one-time and never overwrites an existing court", async () => {
  const room = createRoom();
  expect(await db.mutation(api.court.importLegacy, { secret, room })).toBe(true);
  const other = createRoom();
  expect(await db.mutation(api.court.importLegacy, { secret, room: other })).toBe(true);
  expect(await db.mutation(api.court.importLegacy, { secret, room: other })).toBe(false);
  expect((await sync()).id).toBe(room.id);
  expect((await db.query(api.court.history, { secret, gameId: other.id })).reigns[0].status).toBe("reset");
});

for (const malformed of [false, true]) test(`one HTTP model request per round, malformed=${malformed}`, async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-key");
  const modelFetch = vi.fn(async (_url: unknown, init: RequestInit) => {
    const request = JSON.parse(init.body as string);
    const input = JSON.parse(request.messages[1].content);
    expect(input.suitors).toHaveLength(4);
    expect(input.suitors.filter((s: { npc: boolean }) => !s.npc)).toHaveLength(2);
    expect(input.privatePreferences).toBeTruthy();
    const evaluations = input.suitors.map((s: { seatId: string }) => ({ seatId: s.seatId, text: "An invented answer", reply: "Keep the moon.", feedback: "Strange and sweet.", score: 81 }));
    if (malformed) evaluations.pop();
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ evaluations }) } }] }));
  });
  vi.stubGlobal("fetch", modelFetch);
  const { NextRequest } = await import("next/server");
  const { GET, POST } = await import("../app/api/lobby/route");
  const url = "http://localhost:3107/api/lobby";
  const clients = [];
  for (let i = 0; i < 2; i++) {
    const response = await GET(new NextRequest(url));
    clients.push({ cookie: response.headers.get("set-cookie")!.split(";")[0], state: await response.json() });
  }
  for (const client of clients) {
    await POST(new NextRequest(url, { method: "POST", headers: { cookie: client.cookie }, body: JSON.stringify({ action: "enter" }) }));
    client.state = await (await GET(new NextRequest(url, { headers: { cookie: client.cookie } }))).json();
  }
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    const response = await POST(new NextRequest(url, { method: "POST", headers: { cookie: client.cookie }, body: JSON.stringify({ action: "say", turnKey: client.state.turnKey, text: `Human answer ${i}` }) }));
    expect(response.status).toBe(200);
    expect(background).toHaveLength(i === 0 ? 0 : 1);
    expect(modelFetch).not.toHaveBeenCalled();
  }
  await Promise.all(clients.map(c => GET(new NextRequest(url, { headers: { cookie: c.cookie } }))));
  expect(background).toHaveLength(1);
  await background.shift()!();
  for (const client of clients) {
    const state = await (await GET(new NextRequest(url, { headers: { cookie: client.cookie } }))).json();
    expect(state.phase).toBe("results");
    expect(state.you.dialogue.text).toMatch(/^Human answer/);
    expect(state.you.dialogue.mode).toBe(malformed ? "scripted" : "live");
  }
  expect(background).toHaveLength(0);
  expect(modelFetch).toHaveBeenCalledTimes(1);
});

test("simultaneous final answers claim only one evaluation job", async () => {
  const state = await sync("one"); await sync("two");
  const results = await Promise.all(["one", "two"].map(id => send({ action: "say", id, key: state.turnKey, text: "A moon.", live: true })));
  expect(results.filter(r => r.evaluation)).toHaveLength(1);
  expect((await send({ action: "sync", id: "one", live: true })).evaluation).toBeUndefined();
});

for (const failure of ["http", "length", "timeout"] as const) test(`model ${failure} failure is diagnosed once without retrying`, async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-key");
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const modelFetch = vi.fn(async () => {
    if (failure === "timeout") throw new DOMException("Request timed out", "TimeoutError");
    if (failure === "http") return new Response(JSON.stringify({ error: { code: "rate_limit_exceeded" } }), { status: 429 });
    return new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "{" } }] }));
  });
  vi.stubGlobal("fetch", modelFetch);
  const state = await sync();
  const prepared = await send({ action: "say", id: "player", key: state.turnKey, text: "Secret test answer", live: true });
  const { evaluateRound } = await import("../lib/lobby/ai");
  expect(await evaluateRound(prepared.evaluation!)).toBeNull();
  expect(modelFetch).toHaveBeenCalledTimes(1);
  expect(warn).toHaveBeenCalledTimes(1);
  const diagnostic = JSON.stringify(warn.mock.calls);
  expect(diagnostic).not.toContain("Secret test answer");
  expect(diagnostic).not.toContain(prepared.evaluation!.preferences.prompt);
  expect(diagnostic).toMatch(failure === "http" ? /429.*rate_limit_exceeded/ : failure === "length" ? /token limit/ : /TimeoutError/);
  warn.mockRestore();
});

test("concurrent Next clicks advance only the result both players saw", async () => {
  let state = await sync("one"); await sync("two");
  await send({ action: "say", id: "one", key: state.turnKey, text: "A moon." });
  state = (await send({ action: "say", id: "two", key: state.turnKey, text: "A star." })).state;
  const command = { action: "next" as const, key: state.turnKey, speakerId: state.speakerId! };
  await Promise.all(["one", "two"].map(id => send({ ...command, id })));
  const after = await sync("one");
  expect(after.speakerId).toBe(state.seats[1].id);
  expect((await send({ ...command, id: "one" })).state.speakerId).toBe(after.speakerId);
  expect((await send({ ...command, id: "one", key: "old-turn", speakerId: after.speakerId! })).state.speakerId).toBe(after.speakerId);
});

test("two browser cookies claim distinct NPC seats even when both opened before Enter", async () => {
  const { NextRequest } = await import("next/server");
  const { GET, POST } = await import("../app/api/lobby/route");
  const url = "http://localhost:3107/api/lobby";
  const browsers = [];
  for (let i = 0; i < 2; i++) {
    const response = await GET(new NextRequest(url));
    browsers.push(response.headers.get("set-cookie")!.split(";")[0]);
  }
  expect(browsers[0]).not.toBe(browsers[1]);
  const states = [];
  for (const cookie of browsers) {
    const response = await POST(new NextRequest(url, { method: "POST", headers: { cookie }, body: JSON.stringify({ action: "enter" }) }));
    expect(response.status).toBe(200);
    states.push(await response.json());
  }
  expect(states[0].id).toBe(states[1].id);
  expect(states[0].you.seatId).not.toBe(states[1].you.seatId);
  expect(states[0].you.name).not.toBe(states[1].you.name);
  expect(states[1].seats.filter((s: { kind: string }) => s.kind === "human")).toHaveLength(2);
  for (let i = 0; i < 2; i++) {
    const refreshed = await (await GET(new NextRequest(url, { headers: { cookie: browsers[i] } }))).json();
    expect(refreshed.you.seatId).toBe(states[i].you.seatId);
    expect(refreshed.you.name).toBe(states[i].you.name);
  }
});

test("invite lobbies isolate gameplay, settings and history, and retain settings on reset", async () => {
  const first = await send({ action: "sync", id: "host", lobbyId: "court-alpha", capacity: 2, winnerSitsOut: true });
  const second = await send({ action: "sync", id: "host", lobbyId: "court-bravo", capacity: 15 });
  expect(first.state.id).not.toBe(second.state.id);
  expect(first.state.capacity).toBe(2);
  expect(second.state.capacity).toBe(15);
  const enter = (id: string) => send({ action: "enter", id, lobbyId: "court-alpha" });
  await enter("host");
  const guest = await send({ action: "sync", id: "guest", lobbyId: "court-alpha" });
  expect(guest.state.you?.role).toBe("suitor");
  const denied = await send({ action: "configure", id: "guest", lobbyId: "court-alpha", winnerSitsOut: false });
  expect(denied.error?.status).toBe(403);
  const edited = await send({ action: "configure", id: "host", lobbyId: "court-alpha", winnerSitsOut: false });
  expect(edited.state.winnerSitsOut).toBe(false);
  expect((await send({ action: "configure", id: "host", lobbyId: "court-alpha", capacity: 16 })).error).toBeDefined();
  await send({ action: "say", id: "host", lobbyId: "court-alpha", key: edited.state.turnKey, text: "An answer only in alpha." });
  const untouched = await send({ action: "sync", id: "host", lobbyId: "court-bravo" });
  expect(untouched.state.phase).toBe("lobby");
  expect(untouched.state.you?.submitted).toBe(false);
  expect((await db.query(api.court.history, { secret, gameId: second.state.id })).rounds).toHaveLength(0);
  expect(await db.query(api.court.lineages, { secret, lobbyId: "court-bravo" })).toEqual([]);
  const reset = await send({ action: "reset", id: "host", lobbyId: "court-alpha" });
  expect(reset.state.capacity).toBe(2);
  expect(reset.state.canConfigure).toBe(true);
  expect(reset.state.winnerSitsOut).toBe(false);
  expect((await send({ action: "sync", id: "host", lobbyId: "court-bravo" })).state.id).toBe(second.state.id);
});

test("creating an invite URL preserves the host cookie and accepts distinct browser guests", async () => {
  const { NextRequest } = await import("next/server");
  const { GET, POST } = await import("../app/api/lobby/route");
  const url = "http://localhost:3107/api/lobby";
  const response = await POST(new NextRequest(url, { method: "POST", body: JSON.stringify({ action: "newLobby", capacity: 15, winnerSitsOut: true }) }));
  expect(response.status).toBe(200);
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  const { url: invite } = await response.json();
  expect(invite).toMatch(/^\/l\/[a-f0-9-]{36}$/);
  const endpoint = `${url}?lobby=${invite.split('/').pop()}`;
  const host = await (await GET(new NextRequest(endpoint, { headers: { cookie } }))).json();
  expect(host.canConfigure).toBe(true);
  expect(host.winnerSitsOut).toBe(true);
  const guest = await (await GET(new NextRequest(endpoint))).json();
  expect(guest.id).toBe(host.id);
  expect(guest.canConfigure).toBe(false);
  expect(guest.you.name).not.toBe(host.you.name);
  expect((await GET(new NextRequest(`${url}?lobby=bad!`))).status).toBe(400);
  expect((await POST(new NextRequest(url, { method: "POST", body: JSON.stringify({ action: "newLobby", capacity: 16 }) }))).status).toBe(400);
});

test("optional player limits and timers persist independently per lobby", async () => {
  let state = (await send({ action: "sync", id: "host", lobbyId: "optional-court", minPlayers: 2, maxPlayers: 3, timersEnabled: false })).state;
  expect(state).toMatchObject({ capacity: 3, minPlayers: 2, maxPlayers: 3, timersEnabled: false });
  state = (await send({ action: "enter", id: "host", lobbyId: "optional-court" })).state;
  expect(state.phase).toBe("lobby");
  await send({ action: "sync", id: "guest", lobbyId: "optional-court" });
  state = (await send({ action: "enter", id: "guest", lobbyId: "optional-court" })).state;
  expect(state.phase).toBe("dialogue");
  expect(state.deadline).toBeNull();
  state = (await send({ action: "configure", id: "host", lobbyId: "optional-court", timersEnabled: true })).state;
  expect(state.deadline).toBeGreaterThan(now);
  state = (await send({ action: "configure", id: "host", lobbyId: "optional-court", timersEnabled: false })).state;
  expect(state.deadline).toBeNull();
  state = (await send({ action: "reset", id: "host", lobbyId: "optional-court" })).state;
  expect(state).toMatchObject({ capacity: 3, minPlayers: 2, maxPlayers: 3, timersEnabled: false });
  state = (await send({ action: "configure", id: "host", lobbyId: "optional-court", minPlayers: null, maxPlayers: null })).state;
  expect(state).toMatchObject({ capacity: 15, minPlayers: null, maxPlayers: null });
  expect((await send({ action: "configure", id: "host", lobbyId: "optional-court", minPlayers: 10, maxPlayers: 3 })).error).toBeDefined();
});
