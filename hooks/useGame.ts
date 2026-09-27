"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LobbyOptions } from "@/lib/lobby/options";
import { POLL_MS } from "@/lib/lobby/settings";
import type { RoomView } from "@/lib/lobby/types";

// The only browser game-state hook. The server owns phases, seats, and deadlines.
export function useGame(lobbyId?: string) {
  const endpoint = `/api/lobby${lobbyId ? `?lobby=${encodeURIComponent(lobbyId)}` : ""}`;
  const [state, setState] = useState<RoomView | null>(null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const clockOffset = useRef(0);
  const sending = useRef(false);

  const receive = useCallback((next: RoomView) => {
    clockOffset.current = next.serverNow - Date.now();
    setState(previous => previous && (previous.serverNow > next.serverNow || (previous.id === next.id && previous.revision > next.revision)) ? previous : next);
    setConnected(true);
    setError("");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let closed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error || `The court could not be reached (${response.status}).`);
        }
        const next: RoomView = await response.json();
        if (!controller.signal.aborted) { receive(next); closed = next.closedAt != null; }
      } catch (error) {
        if (!controller.signal.aborted) {
          setConnected(false);
          setError(error instanceof Error ? error.message : "The court could not be reached.");
        }
      } finally {
        if (!controller.signal.aborted && !closed) timer = setTimeout(poll, POLL_MS);
      }
    }
    void poll();
    const clock = setInterval(() => setNow(Date.now()), 250);
    return () => { controller.abort(); clearTimeout(timer); clearInterval(clock); };
  }, [receive, endpoint]);

  const act = useCallback(async (action: "start" | "say" | "create" | "next" | "reset" | "enter" | "configure", text = "", settings?: LobbyOptions) => {
    if (sending.current) return false;
    sending.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(12_000),
        body: JSON.stringify({ action, text, ...settings, turnKey: state?.turnKey, ...(action === "next" ? { speakerId: state?.speakerId, phase: state?.phase } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Try again in a moment.");
      receive(result); return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "The court could not be reached.");
      return false;
    } finally { sending.current = false; setBusy(false); }
  }, [receive, endpoint, state?.turnKey, state?.speakerId, state?.phase]);

  const clock = state ? (now ? now + clockOffset.current : state.serverNow) : 0;
  const remaining = state?.deadline ? Math.max(0, Math.ceil((state.deadline - clock) / 1000)) : null;
  return {
    state, error, busy, connected, remaining, clock,
    say: (text: string) => act("say", text),
    createPrincess: (text: string) => act("create", text),
    next: () => act("next"),
    reset: () => act("reset"),
    enter: () => act("enter"),
    start: () => act("start"),
    configure: (settings: LobbyOptions) => act("configure", "", settings),
  };
}
export type GameController = ReturnType<typeof useGame>;
