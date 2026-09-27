// Turn a server failure into a sentence someone can act on. Secrets stay in the logs.
export function courtFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown court error";
  if (/Configure Convex|before starting the court/i.test(message)) return "The server is missing NEXT_PUBLIC_CONVEX_URL or SUITORS_SERVER_SECRET.";
  if (/Unauthorized/i.test(message)) return "SUITORS_SERVER_SECRET does not match this Convex deployment.";
  if (/ArgumentValidationError|extra field/i.test(message)) return "This deployment’s Convex functions are out of date. Publish them with npx convex deploy.";
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|getaddrinfo|network/i.test(message)) return "The server could not reach Convex. Check NEXT_PUBLIC_CONVEX_URL.";
  const detail = message.replace(/\s+/g, " ").slice(0, 180);
  return `The court could not be reached. ${detail}`;
}
