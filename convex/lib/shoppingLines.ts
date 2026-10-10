/**
 * What two lines must share to be the same line. Lines saved before notes were left
 * off end in them, "1 cup flour (for the dough)", and still match "1 cup flour".
 */
function sameLine(line: string): string {
  return line.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * The lines of a recipe still to put on the list, given the lines of that recipe
 * already there. Each saved line answers for one line of the recipe, so planning a
 * recipe again adds nothing, while a line the recipe lists twice (flour for the
 * dough and for the filling) is kept twice.
 */
export function linesToAdd(saved: string[], lines: string[]): string[] {
  const remaining = new Map<string, number>();
  for (const line of saved) remaining.set(sameLine(line), (remaining.get(sameLine(line)) ?? 0) + 1);

  const toAdd: string[] = [];
  for (const line of lines) {
    const text = line.trim();
    if (!text) continue;
    const count = remaining.get(sameLine(text)) ?? 0;
    if (count > 0) remaining.set(sameLine(text), count - 1);
    else toAdd.push(text);
  }
  return toAdd;
}
