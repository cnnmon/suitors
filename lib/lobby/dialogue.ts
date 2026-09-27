import { questionFor } from "./prompts";
import { TRAITS, type Features, type Preferences } from "./types";

// Every suitor uses the same text-only detector: no selected style or persona prior.
const cues: Record<keyof Features, RegExp> = {
  vulnerability: /\b(honestly|afraid|scared|nervous|lonely|miss|sorry|hurt|truth|feel|admit)\b/gi,
  humor: /\b(joke|funny|laugh|pun|banana|ridiculous|kidding|giggle|chicken|haha|silly)\b/gi,
  boldness: /\b(dare|brave|bold|choose me|let us|let's|i will|dance with me|risk)\b/gi,
  novelty: /\b(imagine|invent|what if|unusual|weird|instead|surprise|new|different)\b/gi,
  agreement: /\b(yes|agree|exactly|totally|of course|you're right|whatever you|me too)\b/gi,
  contrarianism: /\b(disagree|actually|but|wrong|prove|challenge|not really|i don't)\b/gi,
  confidence: /\b(i know|trust me|certain|sure|confident|watch me|obviously|clearly)\b/gi,
  guarded: /\b(secret|perhaps|maybe|mystery|not telling|we'll see|wonder|quiet)\b/gi,
};
export function textFeatures(text: string): Features {
  return Object.fromEntries(TRAITS.map(trait => [trait, Math.min(1, 0.15 + (new Set((text.match(cues[trait]) ?? []).map(t => t.toLowerCase())).size * 0.32))])) as Features;
}
export function judge(features: Features, preferences: Preferences) {
  const magnitude = TRAITS.reduce((sum, trait) => sum + Math.abs(preferences.weights[trait]), 0);
  const adjustment = TRAITS.reduce((sum, trait) => sum + (features[trait] - 0.3) * preferences.weights[trait], 0);
  const raw = 50 + adjustment * 85 / Math.max(3, magnitude);
  return Math.max(4, Math.min(99, Math.round(50 + (raw - 50) * 2.2)));
}
export function impression(score: number) {
  return score >= 60 ? "She leans forward. Something stayed with her." : score >= 45 ? "A small smile. You cannot quite read it." : "Perfectly polite. Somehow, that feels worse.";
}
const adjectives: Record<keyof Features, string> = {
  vulnerability: "open", humor: "funny", boldness: "bold", novelty: "original",
  agreement: "agreeable", contrarianism: "contrary", confidence: "confident", guarded: "mysterious",
};
const phrase = (words: string[]) => words.length < 2 ? words[0] ?? "" : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
// A few adjectives for what she actually heard, not a retelling of the secret prompt.
export function remarks(features: Features, preferences: Preferences) {
  const heard = (trait: keyof Features) => features[trait] > 0.2;
  const liked = TRAITS.filter(trait => preferences.weights[trait] > 0 && heard(trait)).slice(0, 2).map(trait => adjectives[trait]);
  const disliked = TRAITS.filter(trait => preferences.weights[trait] < 0 && heard(trait)).slice(0, 2).map(trait => adjectives[trait]);
  const like = liked.length ? `${phrase(liked).replace(/^./, letter => letter.toUpperCase())}.` : "";
  const dislike = disliked.length ? `Too ${phrase(disliked)}.` : "";
  return `${like} ${dislike}`.trim();
}
export function scriptedDialogue(text: string, preferences: Preferences, turn: number) {
  const features = textFeatures(text);
  const score = text.trim() ? judge(features, preferences) : 0;
  const feedback = text.trim() ? remarks(features, preferences) || impression(score) : "The moment passed without a word.";
  const replies = score >= 60
    ? ["That caught my attention. Tell me something I wouldn't expect next time.", "You almost made me forget there are others waiting.", "Now that is a thought worth keeping."]
    : score >= 45
      ? ["An interesting introduction. I wonder what lies underneath it.", "I heard you. I'm still deciding what to make of it.", "Perhaps. There's more to you than that, isn't there?"]
      : ["You say that so easily. Does it mean what you think it means?", "I think we are hearing different music.", "Hmm. Shall we try a different conversation next time?"];
  return { features, score, feedback, reply: text.trim() ? replies[turn % replies.length] : "" };
}
export function npcText(seat: number, turn: number, reign: number) {
  const { answers } = questionFor(reign, turn);
  return answers[seat % answers.length];
}
