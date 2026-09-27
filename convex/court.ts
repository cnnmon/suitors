import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { preferences, room as roomValidator } from "./schema";
import { createRoom } from "../lib/lobby/engine";
import { execute, type Command, type CommandResult } from "../lib/lobby/commands";
import { reignRecord, roundRecord } from "../lib/lobby/archive";
import { lineagesFrom } from "../lib/lobby/lineage";
import type { Room } from "../lib/lobby/types";

function authorize(secret: string) {
  if (!process.env.SUITORS_SERVER_SECRET || secret !== process.env.SUITORS_SERVER_SECRET) throw new ConvexError("Unauthorized");
}
async function archive(ctx: MutationCtx, room: Room, now: number, reset = false) {
  const reign = reignRecord(room, now, reset);
  const existingReign = await ctx.db.query("reigns").withIndex("by_key", q => q.eq("key", reign.key)).unique();
  if (existingReign) await ctx.db.replace(existingReign._id, reign);
  else await ctx.db.insert("reigns", reign);
  if (room.phase === "lobby") return;
  const round = roundRecord(room, now, reset);
  const existing = await ctx.db.query("rounds").withIndex("by_key", q => q.eq("key", round.key)).unique();
  if (existing && existing.status !== "completed") await ctx.db.replace(existing._id, round);
  else if (!existing) await ctx.db.insert("rounds", round);
}

// Only the Next.js server knows this secret. No database record or private AI context
// is readable directly from a browser, even if someone knows the deployment URL.
export const dispatch = mutation({
  args: { secret: v.string(), command: v.object({
    action: v.union(v.literal("sync"), v.literal("say"), v.literal("next"), v.literal("reset"), v.literal("enter"), v.literal("create"), v.literal("finishRound"), v.literal("finishCreation")),
    id: v.string(), key: v.optional(v.string()), speakerId: v.optional(v.string()), text: v.optional(v.string()), live: v.optional(v.boolean()),
    evaluations: v.optional(v.array(v.object({ seatId: v.string(), text: v.string(), reply: v.string(), score: v.number(), feedback: v.string() }))), preferences: v.optional(v.union(preferences, v.null())),
  }) },
  handler: async (ctx, args): Promise<CommandResult> => {
    authorize(args.secret);
    const saved = await ctx.db.query("lobbies").withIndex("by_key", q => q.eq("key", "shared")).unique();
    const room = (saved?.room ?? createRoom()) as Room;
    const before = structuredClone(room);
    const now = Date.now();
    const result = execute(room, args.command as Command, now);
    if (!saved || before.revision !== room.revision) {
      // Preserve the outgoing round BEFORE a reset or a new princess clears it.
      if (saved) await archive(ctx, before, now, room.id !== before.id);
      await archive(ctx, room, now);
    }
    if (saved) await ctx.db.patch(saved._id, { room, updatedAt: now });
    else await ctx.db.insert("lobbies", { key: "shared", room, updatedAt: now });
    return result;
  },
});

export const lineages = query({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    authorize(args.secret);
    const lobby = await ctx.db.query("lobbies").withIndex("by_key", q => q.eq("key", "shared")).unique();
    if (!lobby) return [];
    const gameId = (lobby.room as Room).id;
    const reigns = await ctx.db.query("reigns").withIndex("by_game", q => q.eq("gameId", gameId)).collect();
    const rounds = await ctx.db.query("rounds").withIndex("by_game", q => q.eq("gameId", gameId)).collect();
    return lineagesFrom(reigns, rounds);
  },
});

export const history = query({
  args: { secret: v.string(), gameId: v.string() },
  handler: async (ctx, args) => {
    authorize(args.secret);
    return {
      reigns: await ctx.db.query("reigns").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect(),
      rounds: await ctx.db.query("rounds").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect(),
    };
  },
});

// One-time migration preserves the existing local court; it never overwrites Convex.
export const importLegacy = mutation({
  args: { secret: v.string(), room: roomValidator },
  handler: async (ctx, args) => {
    authorize(args.secret);
    const live = await ctx.db.query("lobbies").withIndex("by_key", q => q.eq("key", "shared")).unique();
    const room = args.room as Room;
    if (await ctx.db.query("reigns").withIndex("by_key", q => q.eq("key", `${room.id}:${room.reign}`)).unique()) return false;
    const now = Date.now();
    for (const entry of Object.values(room.submissions)) entry.pending = false;
    room.creationPending = false; room.creationId = null;
    for (let turn = 0; turn < room.history.length; turn++) {
      const past = structuredClone(room);
      past.turn = turn; past.phase = "feedback"; past.submissions = past.history[turn]; past.history = past.history.slice(0, turn + 1);
      // Old saves did not keep exact round starts; use the earliest answer timestamp.
      past.turnStartedAt = Math.min(...Object.values(past.submissions).map(s => s.at));
      past.seats.forEach(seat => { seat.total = past.history.reduce((sum, entries) => sum + (entries[seat.id]?.score ?? 0), 0); });
      await archive(ctx, past, now);
    }
    await archive(ctx, room, now, !!live);
    if (!live) await ctx.db.insert("lobbies", { key: "shared", room, updatedAt: now });
    return true;
  },
});
