/** Tier 0 helper: walk the repo and return relative paths of source files. */
import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { detectWorkspaces } from "./workspaces.js";
import { IGNORE_DIRS } from "./ignore.js";
import { isTestFile } from "./fs-util.js";

const SOURCE_RE = /\.(ts|tsx|js|jsx|mjs|cjs|vue)$/;

/** Returns repo-relative, forward-slashed source file paths, sorted. */
export function walkSourceFiles(root: string): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  const members = new Set(detectWorkspaces(root));

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
        // pull a sibling Next.js app in `web/` into the CLI's self-model). But a
        // declared workspace member of a monorepo IS part of this project, so
        // descend into it (otherwise its API/components/data silently vanish).
        const rel = relative(root, full).split("\\").join("/");
        if (existsSync(join(full, "package.json")) && !members.has(rel)) continue;
        stack.push(full);
      } else if (e.isFile() && SOURCE_RE.test(e.name) && !e.name.endsWith(".d.ts")) {
        // Test/spec/story/mock files are verification, not architecture — keep them
        // out of the model so they don't inflate components, the Map, or trust stats.
        const rel = relative(root, full).split("\\").join("/");
        if (!isTestFile(rel)) out.push(rel);
      }
    }
  }
  return out.sort();
}
