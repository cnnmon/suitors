import { readFileSync, writeFileSync } from "node:fs";

const words = readFileSync("lib/moderation/moderation_keywords.csv", "utf8")
  .split(/\r?\n/)
  .map(line => line.trim().toLowerCase())
  .filter(Boolean);

writeFileSync(
  "lib/lobby/blocked-keywords.ts",
  `// Generated from lib/moderation/moderation_keywords.csv. Gitignored.\nexport const MODERATION_KEYWORDS = ${JSON.stringify(words)} as string[];\n`,
);
