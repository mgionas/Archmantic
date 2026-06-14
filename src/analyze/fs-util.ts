/** Shared filesystem walk for the structural detectors (data model, etc.). */
import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { detectWorkspaces } from "./workspaces.js";
import { IGNORE_DIRS as IGNORE } from "./ignore.js";

/** Test/spec/story/mock files — verification, not part of the architecture model. */
export function isTestFile(rel: string): boolean {
  return (
    /(^|\/)(test|tests|__tests__|__mocks__|e2e|cypress)\//i.test(rel) ||
    /\.(test|spec|stories)\.[mc]?[jt]sx?$/i.test(rel)
  );
}

/** Find every file under root whose basename matches `match`, sorted. */
export function findFiles(root: string, match: (name: string) => boolean): string[] {
  const out: string[] = [];
  const stack = [root];
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
        if (IGNORE.has(e.name) || e.name.startsWith(".")) continue;
        // Same scoping rule as walkSourceFiles: skip an independent nested package
        // (own package.json) unless it's a declared workspace member of this repo.
        const rel = relative(root, full).split("\\").join("/");
        if (existsSync(join(full, "package.json")) && !members.has(rel)) continue;
        stack.push(full);
      } else if (e.isFile() && match(e.name)) {
        out.push(full);
      }
    }
  }
  return out.sort();
}
