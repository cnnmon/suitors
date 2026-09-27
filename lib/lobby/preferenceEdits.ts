// Minimum single-character insertions, deletions and replacements (not keystrokes).
// Shared by the editor and server so their budgets always agree.
export function preferenceEdits(before: string, after: string): number {
  const original = Array.from(before.trim());
  const edited = Array.from(after.trim());
  let previous = Array.from({ length: edited.length + 1 }, (_, i) => i);
  for (let i = 0; i < original.length; i++) {
    const current = [i + 1];
    for (let j = 0; j < edited.length; j++) {
      current.push(Math.min(current[j] + 1, previous[j + 1] + 1,
        previous[j] + (original[i] === edited[j] ? 0 : 1)));
    }
    previous = current;
  }
  return previous[edited.length];
}
