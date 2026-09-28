const KEY = "suitors-name";

export function savedName() {
  if (typeof localStorage === "undefined") return null;
  try {
    const name = localStorage.getItem(KEY)?.trim();
    return name || null;
  } catch {
    return null;
  }
}

export function rememberName(name: string) {
  const trimmed = name.trim();
  if (!trimmed || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, trimmed);
  } catch {
    // Private browsing can reject storage; the court still has the name.
  }
}
