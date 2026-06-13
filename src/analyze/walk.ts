/** Tier 0 helper: walk the repo and return relative paths of source files. */
import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".archmantic",
  "coverage",
  ".next",
  "build",
  ".vercel",
]);

const SOURCE_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

/** Returns repo-relative, forward-slashed source file paths, sorted. */
export function walkSourceFiles(root: string): string[] {
  const out: string[] = [];
  const stack: string[] = [root];

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
        if (IGNORE_DIRS.has(e.name) || e.name.startsWith(".")) continue;
        // A nested package (its own package.json) is a separate model — skip it,
        // so analysis stays scoped to the package rooted at `root` (e.g. don't
        // pull a sibling Next.js app in `web/` into the CLI's self-model).
        if (existsSync(join(full, "package.json"))) continue;
        stack.push(full);
      } else if (e.isFile() && SOURCE_RE.test(e.name) && !e.name.endsWith(".d.ts")) {
        out.push(relative(root, full).split("\\").join("/"));
      }
    }
  }
  return out.sort();
}
