# The Suitors and the AI Princess

<img width="974" height="593" alt="image" src="https://github.com/user-attachments/assets/097eba79-7f3e-4cbe-8bd9-e99a19117c71" />

A multiplayer game about competing for an AI princess whose preferences are hidden, mutable, and inherited across reigns.

## How it works

Reloading the page shows a short introduction. A reign begins when a human clicks **Enter the court**.

If no human is seated, the court pauses. **Reset** removes all other human players, seats you alone, and waits for you to enter.

Each player is assigned a random noun name. Your own suitor appears first on your screen and is marked **(You)**. Everyone shares the same court and speaking order; the order shown on your screen does not affect the game.

Each reign lasts **three rounds**.

In every round:

1. The princess asks a built-in question.
2. You answer.
3. The princess responds, scores your answer, and names a few adjectives describing what she liked or disliked.
4. Click **Next** to hear the other suitors' answers and evaluations.

The conversation history preserves each answer, the princess's response, and her adjectives.

After three rounds, the suitor with the highest total score wins.

### Succession

The winner gets to edit the princess's current preference string before the next reign.

They may use up to **20 character edits**, where an edit is an insertion, deletion, or replacement. The final preference string must remain within **80 characters**.

The winner then rejoins the next reign under a new random name, with scores reset.

The princess's exact preferences remain hidden during play and are revealed only after the reign ends.

---

## Run locally

```sh
npm install
npm run convex:dev

# In a second terminal:
npm run dev
```

Convex is already configured for this project's development deployment through the ignored `.env.local`.

For a new checkout, create a Convex deployment:

```sh
npx convex dev
```

Then generate a random server secret and set the same value in `.env.local` and Convex:

```sh
npx convex env set SUITORS_SERVER_SECRET
```

The secret must remain server-only. **Do not prefix it with `NEXT_PUBLIC_`.**

### Optional AI configuration

Add the following to `.env`:

```sh
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-5-mini
```

With an API key:

- Each suitor evaluation costs one model call.
- For NPCs, one call produces the NPC's answer plus the princess's reply, score, and adjectives.
- For humans, the player's typed answer is passed to one call that produces the princess's reply, score, and adjectives.
- The court displays a thinking state until the call returns.
- Creating a new princess uses a separate model call that interprets the edited preference string.

Without an API key, the game falls back to scripted NPC dialogue and a keyword-based scorer, so the full game remains playable.

All clients communicate through the Next.js server. Session cookies and hidden princess preferences are never exposed to client code.

The browser polls the shared court once per second. Game transitions and history writes are handled through atomic Convex mutations.

---

## Game rules

A solo player faces **three NPC opponents**.

With two or more humans, the court keeps at most **two NPCs**, for a maximum of **five seats** total.

Human inactivity is handled as follows:

- Solo human turns have no deadline.
- Multiplayer human turns have a **30-second deadline**.
- A human who fails to answer for two consecutive rounds gives their seat back to its NPC for the remainder of the reign.

Winner selection uses:

1. Total points
2. Final-round score
3. Seat order

The **total score** determines the winner.

The **liking bar** is a separate metric that weights later rounds more heavily.

---

## Saved data

Convex stores game state in three tables.

### `lobbies`

Contains the current shared court, including:

- participants
- turn state
- deadlines
- answers
- current scores

### `reigns`

Contains each princess and reign, including:

- exact preference string
- interpreted preference weights
- creator
- winner
- status

### `rounds`

Contains the immutable record of each completed question, including:

- question
- preference snapshot
- participants
- answers
- princess replies
- evaluations
- evaluation mode
- scores before and after the round
- weighted liking values

A **round** is one question answered by the court.

A **reign** is three rounds.

Completed rounds are immutable. Succession and reset preserve previous records. Interrupted rounds are marked as reset.

The browser receives only the public game view. Reading full archives or mutating game state directly requires the server secret.

---

## Lineages

**Lineages** shows completed reigns, including:

- who won
- what each suitor said
- the princess's preference string

Interpreted preference weights are intentionally omitted from this view.

---

## Migrating an old local save

To import the previous file-based save once:

```sh
npm run db:migrate
```

The migration:

- archives the saved court and any available round history
- preserves the original `.suitors/lobby.json`
- leaves an existing live Convex court untouched
- otherwise makes the imported court live
- ignores duplicate imports of the same reign

Earlier reigns discarded by the old file store cannot be recovered.

Historical round start times are approximated from the earliest saved answer.

---

## Preference editing

The preference editor starts with the current preference text and displays the number of edits used.

Leaving the text unchanged costs zero edits.

Human timeouts preserve the current preferences. NPC succession uses the same 20-edit budget as humans.

To change the limit, edit:

```ts
PREFERENCE_EDIT_LIMIT
```

in:

```text
lib/lobby/settings.ts
```

---

## Project structure

Useful places to modify the game:

- `lib/lobby/settings.ts` — timers, text limits, NPC counts, random names
- `lib/lobby/prompts.ts` — built-in questions and fallback NPC dialogue
- `lib/lobby/engine.ts` — core game rules
- `lib/lobby/commands.ts` — game actions and AI request preparation
- `lib/lobby/archive.ts` — archived round fields and score evolution
- `convex/schema.ts` — database schema
- `convex/court.ts` — Convex transactions
- `hooks/useGame.ts` — browser game-state hook
- `components/Stage.tsx` — stage and character layout
- `components/Conversation.tsx` — dialogue UI

---

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build -- --webpack
```

Tests cover the engine, Convex transactions, and the real Next.js endpoint, including:

- automatic seating
- returning session cookies
- multiple human participants
- the full three-round flow
- pending AI evaluations
- preference succession
- server-secret access
- one-time migration
- preservation of score history after reset

Convex tests run against an isolated in-memory backend and do not modify the live court.


## Invite lobbies

Create a private court to get a separate `/l/<id>` invite URL. Its creator is the admin and chooses when to start. Optional minimum players counts seated humans; the optional maximum caps seats (up to 15). Empty seats use NPCs. Settings also control timers and whether the winner watches the next contest. Player limits can change before starting; timers and succession settings can change during play.

The admin must keep the lobby open. After 25 seconds without an admin heartbeat, Convex permanently closes that lobby; a brief refresh is safe, and guests cannot keep it alive or reopen its link. Archived rounds remain stored. Each browser has its own player cookie. Invite links use the current site origin, so localhost links only work on your own computer.
