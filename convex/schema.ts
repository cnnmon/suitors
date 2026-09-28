import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const features = v.object({ vulnerability: v.number(), humor: v.number(), boldness: v.number(), novelty: v.number(), agreement: v.number(), contrarianism: v.number(), confidence: v.number(), guarded: v.number() });
export const preferences = v.object({ prompt: v.string(), weights: features, source: v.union(v.literal("scripted"), v.literal("assisted"), v.literal("npc")) });
const nullableString = v.union(v.string(), v.null());
const nullableNumber = v.union(v.number(), v.null());
const phase = v.union(...["lobby", "dialogue", "evaluating", "results", "feedback", "reveal", "creating"].map(p => v.literal(p)));
const creator = v.object({ name: v.string(), memberId: nullableString });
const winner = v.union(v.object({ seatId: v.string(), name: v.string(), memberId: nullableString, total: v.number() }), v.null());
const seat = v.object({ id: v.string(), npcName: v.string(), name: v.string(), owner: nullableString, total: v.number() });
const submission = v.object({ text: v.string(), reply: v.string(), feedback: v.string(), score: v.number(), features, by: nullableString, mode: v.union(v.literal("live"), v.literal("scripted")), pending: v.boolean(), timedOut: v.boolean(), at: v.number() });
export const room = v.object({
  closedAt: v.optional(nullableNumber), adminWatchStarted: v.optional(v.boolean()),
  minPlayers: v.optional(nullableNumber), maxPlayers: v.optional(nullableNumber), timersEnabled: v.optional(v.boolean()),
  capacity: v.optional(v.number()), winnerSitsOut: v.optional(v.boolean()), ownerId: v.optional(nullableString), advisorId: v.optional(nullableString),
  version: v.literal(1), id: v.string(), revision: v.number(), reign: v.number(), turn: v.number(), phase, speaker: v.number(),
  deadline: nullableNumber, turnStartedAt: v.number(), seats: v.array(seat),
  members: v.record(v.string(), v.object({ name: v.string(), lastSeen: v.number(), joinedAt: v.number(), seatId: nullableString, misses: v.optional(v.number()), entered: v.optional(v.boolean()) })),
  preferences, lastRevealedPreference: v.optional(nullableString), creator, winner, submissions: v.record(v.string(), submission), history: v.array(v.record(v.string(), submission)),
  creationPending: v.boolean(), creationId: nullableString, pausedAt: v.optional(v.union(v.number(), v.null())),
  evaluation: v.optional(v.union(v.object({ owner: v.string(), key: v.string() }), v.null())),
});

export default defineSchema({
  presence: defineTable({ gameId: v.string(), memberId: v.string(), lastSeen: v.number() })
    .index("by_member", ["gameId", "memberId"]).index("by_game_seen", ["gameId", "lastSeen"]),
  lobbies: defineTable({ key: v.string(), room, updatedAt: v.number() }).index("by_key", ["key"]),
  reigns: defineTable({
    key: v.string(), gameId: v.string(), reign: v.number(), preferences, creator, winner,
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("reset")), updatedAt: v.number(),
  }).index("by_key", ["key"]).index("by_game", ["gameId", "reign"]),
  rounds: defineTable({
    key: v.string(), gameId: v.string(), reign: v.number(), turn: v.number(), question: v.string(), preferences,
    phase, status: v.union(v.literal("active"), v.literal("completed"), v.literal("reset")),
    startedAt: v.number(), updatedAt: v.number(), seats: v.array(seat),
    // Includes the answer, princess reply, evaluation, traits, score, and live/fallback mode.
    answers: v.record(v.string(), submission),
    scoreEvolution: v.array(v.object({ seatId: v.string(), name: v.string(), memberId: nullableString, before: v.number(), roundScore: nullableNumber, after: v.number(), likedBefore: v.number(), likedAfter: v.number() })),
  }).index("by_key", ["key"]).index("by_game", ["gameId", "reign", "turn"]),
});
