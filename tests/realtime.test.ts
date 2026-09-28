import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { RoomView } from "../lib/lobby/types";
import { HEARTBEAT_MS } from "../lib/lobby/settings";

const socket = vi.hoisted(() => ({
  update: null as null | ((version: { id: string; revision: number } | null) => void),
  error: null as null | ((error: Error) => void),
  close: vi.fn(), unsubscribe: vi.fn(),
}));
vi.mock("convex/browser", () => ({ ConvexClient: class {
  onUpdate(_query: unknown, _args: unknown, update: typeof socket.update, error: typeof socket.error) {
    socket.update = update; socket.error = error; return socket.unsubscribe;
  }
  subscribeToConnectionState() { return () => {}; }
  close() { socket.close(); return Promise.resolve(); }
} }));
import { watchCourt } from "../lib/lobby/realtime";

let current: RoomView;
let stop: () => void;
let fetchMock: ReturnType<typeof vi.fn>;
const receive = vi.fn();
const fail = vi.fn();
const flush = () => vi.advanceTimersByTimeAsync(0);
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(1_000_000); vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");
  current = { id: "court", revision: 1, serverNow: Date.now(), wakeAt: null, closedAt: null } as RoomView;
  fetchMock = vi.fn(async (url: string) => url.includes("presence=1")
    ? new Response(null, { status: 204 })
    : Response.json({ ...current, serverNow: Date.now() }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { stop?.(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

test("idle clients subscribe and send only a small heartbeat every ten seconds", async () => {
  stop = watchCourt("/api/lobby?lobby=test-court", receive, fail);
  await flush();
  socket.update!({ id: "court", revision: 1 });
  await vi.advanceTimersByTimeAsync(HEARTBEAT_MS - 1);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][0]).toBe("/api/lobby?lobby=test-court&presence=1");
  expect(receive).toHaveBeenCalledTimes(1);
  expect(fail).not.toHaveBeenCalled();
});

test("a subscription change fetches the player's view immediately", async () => {
  stop = watchCourt("/api/lobby", receive, fail); await flush();
  current.revision = 2;
  socket.update!({ id: "court", revision: 2 }); await flush();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(receive.mock.lastCall![0].revision).toBe(2);
  socket.update!({ id: "court", revision: 2 }); await flush();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("a phase deadline wakes the server without waiting for a heartbeat", async () => {
  current.wakeAt = Date.now() + 3_000;
  stop = watchCourt("/api/lobby", receive, fail); await flush();
  socket.update!({ id: "court", revision: 1 });
  current = { ...current, revision: 2, wakeAt: null };
  await vi.advanceTimersByTimeAsync(3_050);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][0]).toBe("/api/lobby");
  expect(receive.mock.lastCall![0].revision).toBe(2);
});

test("notifications during a fetch coalesce without losing the final update", async () => {
  let resolve!: (value: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
  stop = watchCourt("/api/lobby", receive, fail);
  for (let revision = 1; revision <= 5; revision++) socket.update!({ id: "court", revision });
  current.revision = 5;
  resolve(Response.json({ ...current, revision: 1 })); await flush();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(receive.mock.lastCall![0].revision).toBe(5);
});

test("subscription failure falls back at heartbeat speed and stopping releases resources", async () => {
  stop = watchCourt("/api/lobby", receive, fail); await flush();
  socket.error!(new Error("Disconnected"));
  await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
  expect(fetchMock.mock.calls[1][0]).toBe("/api/lobby");
  stop();
  expect(socket.close).toHaveBeenCalled();
  expect(socket.unsubscribe).toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 3);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
