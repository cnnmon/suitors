# The Suitors and the AI Princess

Reloading the page opens a short explanation. The reign starts when a human clicks **Enter the court**. If no human is seated, the court pauses. **Reset** removes every other human, seats you alone, and waits for Enter. You are seated with a random noun name. Your suitor appears first on your screen, marked **(You)**. Everyone shares one court and the same speaking order; your screen order does not change it.

The princess asks a built-in question each turn. Answer, read her reaction and score, then click **Next** to hear the other suitors. When she scores an answer she names a few adjectives she liked or disliked. The history keeps those words and her reply. After three turns, the highest total wins and edits the current preferences with a budget of **20 character edits** (insertions, deletions, or replacements), keeping the full string within **80 characters**. The winner rejoins the following reign under a new random name, with scores reset. Preferences are revealed only when that reign ends.

## Run

```sh
npm install
npm run convex:dev
# In a second terminal:
npm run dev
```

Convex is already configured for this project's development deployment in the ignored `.env.local`. A new checkout needs a Convex deployment (`npx convex dev`) and a server-only `SUITORS_SERVER_SECRET` set to the same random value in `.env.local` and in Convex (`npx convex env set SUITORS_SERVER_SECRET`). Never prefix this secret with `NEXT_PUBLIC_`.

Optional `.env` settings:

```sh
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-5-mini
```

With a key, each suitor costs one model call. An NPC’s line and the princess’s reply, score, and adjectives come back together; a human’s line is what they typed, and the same call writes her reply and score. The court shows thinking until that call returns. Saving a new princess is a separate call that only interprets her preferences. Without a key, scripted lines and a keyword scorer keep the game playable. All users connect through the Next.js server, which keeps session cookies and private preferences out of client code. The game hook polls the shared court once per second; transitions and history writes are atomic Convex mutations.

## Saved data

The Convex dashboard has three tables:

- **lobbies:** the current shared court, participants, deadlines, answers and current scores.
- **reigns:** each princess’s exact preference string, interpreted weights, creator, winner and status.
- **rounds:** each question, preference snapshot, participants, answers, princess replies, evaluations, evaluation mode, and scores before and after the round. Weighted liking values are included separately from total points.

A round means one question answered by the court. A reign is three rounds. Completed rounds remain immutable. Succession and reset retain previous records; interrupted rounds are marked as reset. The browser gets only the public game view. Reading full archives or writing game state requires the server secret.

To import the previous local save once:

```sh
npm run db:migrate
```

This archives the saved court and its available round history and keeps the original `.suitors/lobby.json`. If Convex already has a live court, it is left untouched; otherwise the imported court becomes live. Re-importing the same reign does nothing. Earlier reigns discarded by the old file store cannot be recovered. Historical round start times are approximated from their earliest saved answer.

## Easy places to edit

- `lib/lobby/settings.ts`: timers, length limits, NPC counts and random names.
- `lib/lobby/prompts.ts`: built-in questions and the NPC lines used when no model key is set.
- `lib/lobby/engine.ts`: game rules.
- `lib/lobby/commands.ts`: game actions and AI request preparation.
- `lib/lobby/archive.ts`: fields saved for each round and score evolution.
- Lineages opens finished reigns: who won, what they said, and that princess’s preference. Weights stay off that list.
- `convex/schema.ts` and `convex/court.ts`: database schema and transactions.
- `hooks/useGame.ts`: browser game-state hook.
- `components/Stage.tsx` and `components/Conversation.tsx`: art layout and dialogue UI.

A solo player currently has three NPC opponents; two or more humans keep at most two NPCs, up to five seats. A human who says nothing for two rounds in a row gives that seat back to its NPC for the rest of the reign. Solo turns have no deadline. Multiplayer human turns allow 30 seconds. Ties use the final-turn score, then seat order. Total points choose the winner; the liking bar weights later rounds more heavily.

## Check

```sh
npm test
npm run typecheck
npm run lint
npm run build -- --webpack
```

Tests cover the engine plus Convex transactions and the actual Next.js endpoint: automatic seating, returning cookies, multiple participants, the full three-round flow, pending AI evaluations, preference succession, secret access, one-time migration, and preserving score history after reset. Convex tests use an isolated in-memory backend and do not modify the live court.

The preference editor starts with the current text and shows edits used. Keeping the text costs zero edits. Human timeouts preserve the current tastes; NPC changes use the same 20-edit limit. Tune `PREFERENCE_EDIT_LIMIT` in `lib/lobby/settings.ts`.
