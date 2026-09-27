import { PREFERENCE_LIMIT, STARTER_PROMPT } from "./settings";
import { TRAITS, type Features, type Preferences } from "./types";

export const emptyWeights = (): Features => Object.fromEntries(TRAITS.map(t => [t, 0])) as Features;
export function validWeights(value: unknown): value is Features {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const weights = value as Features;
  return TRAITS.every(t => Number.isInteger(weights[t]) && weights[t] >= -3 && weights[t] <= 3) && TRAITS.some(t => weights[t] !== 0);
}
export function validPreferences(value: unknown): value is Preferences {
  if (!value || typeof value !== "object") return false;
  const p = value as Preferences;
  return typeof p.prompt === "string" && !!p.prompt.trim() && p.prompt.length <= PREFERENCE_LIMIT &&
    ["scripted", "assisted", "npc"].includes(p.source) && validWeights(p.weights);
}
export const starterPreferences = (): Preferences => ({ prompt: STARTER_PROMPT, weights: interpretShortPreferences(STARTER_PROMPT)!, source: "scripted" });

// Offline interpretation supports explicit likes/dislikes of recognizable traits.
// Unknown prompts are rejected rather than silently assigning unrelated rules.
export function interpretShortPreferences(prompt: string): Features | null {
  if (!prompt.trim() || prompt.length > PREFERENCE_LIMIT) return null;
  const weights = emptyWeights();
  const terms: Array<[keyof Features, RegExp]> = [
    ["vulnerability", /\b(openness|open|honest|honesty|vulnerable|vulnerability|sincere|sincerity)\b/g],
    ["humor", /\b(humor|humour|funny|jokes?|laughter|laugh|witty|wit)\b/g],
    ["boldness", /\b(bold|boldness|daring|brave|bravery)\b/g],
    ["novelty", /\b(original(?:ity)?|novelty|creative|creativity|surprises?|unusual)\b/g],
    ["agreement", /\b(agree(?:ment|able)?|flattery|flattering|obedience|obedient)\b/g],
    ["contrarianism", /\b(pushback|contrarian(?:ism)?|disagree(?:ment)?|debate|argumentative)\b/g],
    ["confidence", /\b(confident|confidence|arrogance|arrogant|swagger)\b/g],
    ["guarded", /\b(mystery|mysterious|secrets?|guarded|reserved)\b/g],
  ];
  const normalized = prompt.toLowerCase().replace(/[’]/g, "'");
  const events: Array<{ at: number; trait?: keyof Features; sign?: number }> = [];
  for (const [trait, regex] of terms) for (const match of normalized.matchAll(regex)) events.push({ at: match.index, trait });
  const cues = /\b((?:do not|don't|does not|doesn't|never)\s+(?:reward|like|prefer|enjoy)|dislikes?|hates?|avoid|penalize|no|not|never|without|don't|doesn't|likes?|loves?|reward|prefer(?:s)?|enjoy(?:s)?|wants?)\b|[.;!?]/g;
  for (const match of normalized.matchAll(cues)) events.push({ at: match.index, sign: /^(dislike|hate|avoid|penalize|no$|not|never|without|do not|does not|don't|doesn't)/.test(match[0]) ? -1 : 1 });
  let sign = 1;
  for (const event of events.sort((a, b) => a.at - b.at)) {
    if (event.sign !== undefined) sign = event.sign;
    else if (event.trait) weights[event.trait] = sign * 2;
  }
  return validWeights(weights) ? weights : null;
}
