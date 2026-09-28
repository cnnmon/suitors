# The Suitors and the AI Princess

<img width="1138" height="632" alt="image" src="https://github.com/user-attachments/assets/6b479496-b06c-475d-85eb-8b940816676f" />

## How it works

"The Suitors and the AI Princess" is a multiplayer digital party game where players compete as suitors trying to win the hand of an AI princess. Players must infer and adapt to her secret tastes across 3 trials. The highest-scoring suitor is crowned king. The princess's hidden preference string is then revealed, and the winner may (secretly!) make up to **20 character edits** before the next reign. The string must stay within **80 characters**. Scores reset and the winner rejoins under a new random name.

As AI evaluation pervades social media, workplace hiring, and everyday decision-making, this game explores how opaque evaluators shape the people trying to satisfy them. It also asks who gets to define the values those evaluators enforce in the first place, and what happens when those values are passed down through a game of telephone. The game is meant to be played with friends or strangers: experiment in a private lobby or compete on a rapid-fire public stage. Design, art, and snippets of code were made by me. The AI princess and NPCs are running on `gpt-5-mini`.

## Run locally

```sh
npm install
npm run convex:dev

# In a second terminal:
npm run dev
```

For a new checkout, run:

```sh
npx convex dev
npx convex env set SUITORS_SERVER_SECRET
```

Set the same `SUITORS_SERVER_SECRET` in `.env.local`. Keep it server-only; never prefix it with `NEXT_PUBLIC_`.

Optional AI settings:

```sh
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-5-mini
```

With an API key, model calls generate NPC answers and princess evaluations. Without one, scripted dialogue and a keyword scorer keep the game playable.

Clients connect through the Next.js server, while Convex stores and atomically updates shared game state.

## Game rules

- The court always has **4 NPCs**. Humans who join sit as extra suitors and do not replace them.
- Shared court holds up to **5 humans**. Private lobbies can hold up to **15**.
- Solo turns have no deadline; multiplayer human turns have **30 seconds**.
- Missing two rounds unseats that human for the rest of the reign.
- Winner tiebreaks: total score → final-round score → seat order.
- The liking bar is separate from total score and weights later rounds more heavily.

## Saved data

Convex uses three main tables:

- `lobbies` — live court, participants, turns, answers, deadlines, scores
- `reigns` — princess preferences, interpreted weights, creator, winner, status
- `rounds` — immutable round history, answers, evaluations, and score changes

A reign contains three rounds. Completed rounds remain archived; interrupted rounds are marked as reset. Hidden preferences and full archives stay server-side.

## Lineages

**Lineages** shows finished reigns, including the winner, suitor responses, and the princess's revealed preference string. Internal preference weights are omitted.

## Import old saves

```sh
npm run db:migrate
```

This imports the previous `.suitors/lobby.json` save once without overwriting an existing live Convex court. Earlier discarded reigns cannot be recovered.

## Invite lobbies

Private courts get their own `/l/<id>` invite URL. The creator is the admin and controls when the game starts, player limits, timers, and succession settings. Empty seats are filled by four NPCs; additional humans sit beside them.

The admin must keep the lobby open. If no admin heartbeat is received for 25 seconds, the lobby closes permanently, though archived rounds remain stored.

## Key files

- `lib/lobby/settings.ts` — timers, limits, NPC counts, names
- `lib/lobby/moderation.ts` — blocked names, loaded from the gitignored `lib/moderation/moderation_keywords.csv`
- `lib/lobby/prompts.ts` — questions and fallback dialogue
- `lib/lobby/engine.ts` — game rules
- `lib/lobby/commands.ts` — actions and AI requests
- `lib/lobby/archive.ts` — round history
- `convex/schema.ts`, `convex/court.ts` — database and transactions
- `hooks/useGame.ts` — client state
- `components/Stage.tsx`, `components/Conversation.tsx` — UI

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build -- --webpack
```

Tests cover seating, multiplayer flow, AI evaluations, succession, migration, security, resets, and score-history preservation using an isolated Convex backend.
