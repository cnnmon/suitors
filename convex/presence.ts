import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Room } from "../lib/lobby/types";
import { HEARTBEAT_MS, PRESENCE_MS } from "../lib/lobby/settings";

// Timestamps change independently of the game document, so heartbeats do not
// invalidate every browser's game subscription. Existing rooms migrate lazily.
export async function hydratePresence(ctx: QueryCtx, room: Room, now: number) {
  const present = await ctx.db.query("presence")
    .withIndex("by_game_seen", q => q.eq("gameId", room.id).gte("lastSeen", now - PRESENCE_MS))
    .collect();
  for (const { memberId, lastSeen } of present) {
    const member = room.members[memberId];
    if (member) member.lastSeen = Math.max(member.lastSeen, lastSeen);
  }
}

export async function recordPresence(ctx: MutationCtx, room: Room, memberId: string, now: number) {
  if (room.closedAt != null || !room.members[memberId]) return;
  const previous = await ctx.db.query("presence")
    .withIndex("by_member", q => q.eq("gameId", room.id).eq("memberId", memberId)).unique();
  // Coalesce actions and legacy clients' frequent polls; allow heartbeat jitter.
  if (previous && now - previous.lastSeen < HEARTBEAT_MS / 2) return;
  if (previous) await ctx.db.patch(previous._id, { lastSeen: now });
  else await ctx.db.insert("presence", { gameId: room.id, memberId, lastSeen: now });
}

export function gameState(room: Room) {
  return JSON.stringify(room, (key, value) => key === "lastSeen" ? undefined : value);
}
