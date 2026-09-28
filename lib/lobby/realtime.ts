import { ConvexClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { savedName } from "./savedName";
import { HEARTBEAT_MS } from "./settings";
import type { RoomView } from "./types";

// Subscribe only to a public revision signal. Private player views still travel
// through the HttpOnly session cookie; no identity or server secret enters Convex JS.
export function watchCourt(endpoint: string, receive: (state: RoomView) => void, fail: (message: string) => void) {
  const controller = new AbortController();
  const lobbyId = new URL(endpoint, "http://localhost").searchParams.get("lobby") || undefined;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const client = url ? new ConvexClient(url) : null;
  let latest: RoomView | null = null;
  let inFlight = false;
  let queued = false;
  let subscribed = false;
  let closed = false;
  let wake: ReturnType<typeof setTimeout> | undefined;

  async function refresh(presenceOnly = false) {
    if (controller.signal.aborted || closed) return;
    if (inFlight) { if (!presenceOnly) queued = true; return; }
    inFlight = true;
    try {
      const path = presenceOnly ? `${endpoint}${endpoint.includes("?") ? "&" : "?"}presence=1` : endpoint;
      const name = savedName();
      const response = await fetch(path, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]), ...(name ? { headers: { "x-suitor-name": name } } : {}) });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error || `The court could not be reached (${response.status}).`);
      }
      if (response.status === 204) return;
      const next: RoomView = await response.json();
      if (controller.signal.aborted) return;
      latest = next;
      receive(next);
      closed = next.closedAt != null;
      clearTimeout(wake);
      // A single deadline wake replaces continuous countdown polling. The server
      // still validates/advances the phase and claims at most one AI job.
      if (!closed && next.wakeAt != null) {
        wake = setTimeout(() => { void refresh(); }, Math.max(250, next.wakeAt - next.serverNow + 50));
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        subscribed = false; // Heartbeats fetch a full snapshot until recovery.
        fail(error instanceof Error ? error.message : "The court could not be reached.");
      }
    } finally {
      inFlight = false;
      if (queued && !controller.signal.aborted) { queued = false; void refresh(); }
    }
  }

  const unsubscribe = client?.onUpdate(api.court.version, lobbyId ? { lobbyId } : {}, version => {
    subscribed = true;
    if (version && (version.id !== latest?.id || version.revision !== latest?.revision)) void refresh();
  }, error => { subscribed = false; fail(error.message); });
  const connection = client?.subscribeToConnectionState(state => {
    if (state.isWebSocketConnected) void refresh();
    else subscribed = false;
  });
  const heartbeat = setInterval(() => { void refresh(!!latest && subscribed); }, HEARTBEAT_MS);
  void refresh();
  return () => {
    if (controller.signal.aborted) return;
    controller.abort();
    clearInterval(heartbeat);
    clearTimeout(wake);
    unsubscribe?.(); connection?.();
    void client?.close();
  };
}
