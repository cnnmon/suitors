import { MODERATION_KEYWORDS } from "./blocked-keywords";

function compact(text: string) {
  return text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
}

export function blockedName(name: string) {
  const folded = name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const squeezed = compact(name);
  const words = folded.split(/[^a-z0-9]+/).filter(Boolean);
  return MODERATION_KEYWORDS.some(keyword => {
    if (words.includes(keyword) || squeezed === keyword) return true;
    return keyword.length >= 4 && squeezed.includes(keyword);
  });
}

export { MODERATION_KEYWORDS };
