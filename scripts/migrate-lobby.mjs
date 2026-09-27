import nextEnv from '@next/env';
import { readFile } from 'node:fs/promises';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
nextEnv.loadEnvConfig(process.cwd());
let room;
try { room = JSON.parse(await readFile('.suitors/lobby.json', 'utf8')); }
catch (error) {
  if (error.code === 'ENOENT') { console.log('No local court to migrate.'); process.exit(0); }
  throw error;
}
const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
const imported = await client.mutation(makeFunctionReference('court:importLegacy'), {
  secret: process.env.SUITORS_SERVER_SECRET, room,
});
console.log(imported ? 'Archived the saved court and available rounds. Existing Convex play and original file retained.' : 'This saved reign was already imported; nothing overwritten.');
