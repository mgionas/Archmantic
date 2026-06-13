/** Shared filesystem walk for the structural detectors (data model, etc.). */
import { readdirSync } from "node:fs";
import { join } from "node:path";

const IGNORE = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".vercel",
  ".archmantic",
]);

/** Find every file under root whose basename matches `match`, sorted. */
export function findFiles(root: string, match: (name: string) => boolean): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (IGNORE.has(e.name) || e.name.startsWith(".")) continue;
        stack.push(full);
      } else if (e.isFile() && match(e.name)) {
        out.push(full);
      }
    }
  }
  return out.sort();
}
