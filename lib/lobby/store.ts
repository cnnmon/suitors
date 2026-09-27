// The Next.js server is the only client of private Convex game mutations.
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Command, CommandResult } from "./commands";
import type { Lineage } from "./lineage";

function client() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.SUITORS_SERVER_SECRET;
  if (!url || !secret) throw new Error("Configure Convex and SUITORS_SERVER_SECRET before starting the court.");
  return { secret, client: new ConvexHttpClient(url) };
}

export async function dispatch(command: Command): Promise<CommandResult> {
  const { secret, client: convex } = client();
  return convex.mutation(api.court.dispatch, { secret, command });
}

export async function lineages(lobbyId?: string): Promise<Lineage[]> {
  const { secret, client: convex } = client();
  return convex.query(api.court.lineages, { secret, ...(lobbyId ? { lobbyId } : {}) });
}
