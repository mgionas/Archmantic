/**
 * Monorepo workspace detection.
 *
 * The structural walkers (`walkSourceFiles`, `findFiles`) skip nested packages
 * (dirs with their own `package.json`) so an independent sibling app — e.g. our
 * own `web/` — doesn't bleed into the package rooted at `root`. But a *declared
 * workspace member* of a monorepo (npm/yarn `workspaces`, `pnpm-workspace.yaml`)
 * IS part of this project and must be analyzed — otherwise its API surface,
 * components, and data model silently vanish. This module resolves the declared
 * member directories so the walkers can descend into exactly those.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
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

/** Read declared workspace globs from npm/yarn `package.json` and pnpm-workspace.yaml. */
function workspaceGlobs(root: string): string[] {
  const globs: string[] = [];
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      workspaces?: string[] | { packages?: string[] };
    };
    const ws = pkg.workspaces;
    if (Array.isArray(ws)) globs.push(...ws);
    else if (ws && Array.isArray(ws.packages)) globs.push(...ws.packages);
  } catch {
    /* no/invalid root package.json */
  }
  const pnpm = join(root, "pnpm-workspace.yaml");
  if (existsSync(pnpm)) {
    try {
      let inPackages = false;
      for (const raw of readFileSync(pnpm, "utf8").split("\n")) {
        const line = raw.replace(/#.*$/, "");
        if (/^packages\s*:/.test(line)) {
          inPackages = true;
          continue;
        }
        if (!inPackages) continue;
        const m = /^\s*-\s*['"]?([^'"]+?)['"]?\s*$/.exec(line);
        if (m) globs.push(m[1]!.trim());
        else if (/^\S/.test(line)) inPackages = false; // dedented to the next top-level key
      }
    } catch {
      /* ignore malformed yaml */
    }
  }
  return globs;
}

/** Expand one workspace glob to concrete member dirs (relative, forward-slashed). */
function expand(root: string, pattern: string): string[] {
  if (pattern.startsWith("!")) return []; // pnpm negations — not members
  const segs = pattern.split("/").filter(Boolean);
  let dirs: string[] = [""];
  for (const seg of segs) {
    const next: string[] = [];
    for (const d of dirs) {
      if (seg === "*" || seg === "**") {
        // `**` is treated as a single level — covers the common `packages/*` and
        // `packages/**` monorepo layouts without a full glob engine.
        let entries;
        try {
          entries = readdirSync(join(root, d), { withFileTypes: true });
        } catch {
          continue;
        }
        for (const e of entries) {
          if (!e.isDirectory() || IGNORE.has(e.name) || e.name.startsWith(".")) continue;
          next.push(d ? `${d}/${e.name}` : e.name);
        }
      } else {
        const cand = d ? `${d}/${seg}` : seg;
        if (existsSync(join(root, cand))) next.push(cand);
      }
    }
    dirs = next;
  }
  // A member is a directory that actually carries its own package.json.
  return dirs.filter((d) => d && existsSync(join(root, d, "package.json")));
}

/**
 * Conventional monorepo container dirs. When a repo declares no workspaces but
 * still lays out sub-packages this way (Turborepo/Nx, or plain convention), any
 * immediate child carrying its own package.json is treated as a member — so e.g.
 * `apps/admin` + `apps/api` are discovered dynamically without a manifest.
 */
const CONVENTION_ROOTS = ["apps", "packages", "services", "libs", "modules", "plugins"];

/** Immediate subdirectories of `parent` that carry their own package.json. */
function packagesUnder(root: string, parent: string): string[] {
  const out: string[] = [];
  let entries;
  try {
    entries = readdirSync(join(root, parent), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (!e.isDirectory() || IGNORE.has(e.name) || e.name.startsWith(".")) continue;
    const rel = `${parent}/${e.name}`;
    if (existsSync(join(root, rel, "package.json"))) out.push(rel);
  }
  return out;
}

/**
 * Workspace member directories (relative, forward-slashed), sorted & deduped.
 * Fully dynamic — never hardcodes package names. Prefers the repo's declared
 * workspaces (npm/yarn/pnpm); falls back to convention-based discovery so
 * undeclared monorepos (apps/*, packages/*, …) still analyze as one model.
 */
export function detectWorkspaces(root: string): string[] {
  const out = new Set<string>();
  for (const g of workspaceGlobs(root)) for (const d of expand(root, g)) out.add(d);
  if (out.size === 0) {
    for (const dir of CONVENTION_ROOTS) for (const m of packagesUnder(root, dir)) out.add(m);
  }
  return [...out].sort();
}

/** The owning workspace member for a repo-relative path (longest prefix), or undefined for root. */
export function packageOf(rel: string, members: string[]): string | undefined {
  let best: string | undefined;
  for (const m of members) {
    if ((rel === m || rel.startsWith(m + "/")) && (!best || m.length > best.length)) best = m;
  }
  return best;
}
