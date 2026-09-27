// Change these to tune the game. Times are milliseconds.
export const PLAYER_NOUNS = ["Moth", "Teapot", "Pebble", "Moss", "Button", "Comet", "Toast", "Fern", "Spoon", "Cloud", "Acorn", "Puddle", "Velvet", "Cricket", "Marble", "Lantern"];
export const NPC_NAMES = ["Pip", "Dot", "Bop", "Nib", "Kit"];
// One human stands with three NPCs (four suitors). Two or more humans keep at most two NPCs.
export const courtSize = (humans: number) => humans <= 1 ? 4 : Math.min(NPC_NAMES.length, humans + 2);
export const TURN_COUNT = 3;
export const TURN_MS = 30_000;
export const FEEDBACK_MS = 8_000;
export const REVEAL_MS = 12_000;
export const CREATE_MS = 45_000;
export const LOBBY_MS = 6_000;
export const NPC_CREATE_MS = 3_000;
export const NPC_FIRST_MESSAGE_MS = 2_500;
export const NPC_MESSAGE_GAP_MS = 550;
export const MIN_TURN_MS = 5_000;
export const PRESENCE_MS = 25_000;
export const POLL_MS = 1_000;
export const THINK_MS = 800;
export const SIGN_MS = 2_400;
export const MESSAGE_LIMIT = 240;
export const PREFERENCE_LIMIT = 80;
export const PREFERENCE_EDIT_LIMIT = 20;
export const NAME_LIMIT = 18;
export const STARTER_PROMPT = "Likes humor, original ideas and openness. Dislikes empty agreement.";
export const NPC_PREFERENCES = [
  "Likes humor and originality. Dislikes flattery.",
  "Likes quiet confidence. Dislikes pushback.",
  "Likes openness and mystery. Dislikes boldness.",
  "Likes brave, original ideas. Dislikes agreement.",
];
