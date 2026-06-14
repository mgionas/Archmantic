/**
 * Project manifest — the human-authored "project brain" (goal, author, agent
 * team, links, history) committed at `.archmantic/project.json` and merged into
 * the model during analysis. Intent that can't be reverse-engineered from code.
 * See docs/design/SPEC-LAYER.md (Phase 1).
 */
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { type ProjectManifest, type AgentRef } from "../ir/types.js";

export const MANIFEST_PATH = join(".archmantic", "project.json");

/** Read `.archmantic/project.json`, or undefined if absent/malformed. */
export function readManifest(root: string): ProjectManifest | undefined {
  const p = join(root, MANIFEST_PATH);
  if (!existsSync(p)) return undefined;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as ProjectManifest;
  } catch {
    return undefined;
  }
}

/** Pull `name:`/`description:` from a markdown frontmatter block (best-effort). */
function frontmatter(text: string): Record<string, string> {
  const m = /^---\s*\n([\s\S]*?)\n---/.exec(text);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1]!.split("\n")) {
    const kv = /^([A-Za-z_]+)\s*:\s*(.+?)\s*$/.exec(line);
    if (kv) out[kv[1]!.toLowerCase()] = kv[2]!.replace(/^['"]|['"]$/g, "");
  }
  return out;
}

/** Discover the project's agent team from `.claude/agents/*.md` (name + role). */
export function detectAgents(root: string): AgentRef[] {
  const dir = join(root, ".claude", "agents");
  let entries: string[];
  try {
    entries = readdirSync(dir).filter((n) => n.endsWith(".md"));
  } catch {
    return [];
  }
  const out: AgentRef[] = [];
  for (const file of entries.sort()) {
    const abs = join(dir, file);
    let fm: Record<string, string> = {};
    try {
      fm = frontmatter(readFileSync(abs, "utf8"));
    } catch {
      /* unreadable — fall back to filename */
    }
    const name = fm.name ?? file.replace(/\.md$/, "");
    const ref: AgentRef = { name, file: relative(root, abs).split("\\").join("/") };
    if (fm.description) ref.role = fm.description;
    out.push(ref);
  }
  return out;
}

/**
 * Merge the manifest into the model: the committed `project.json` wins; the agent
 * team auto-seeds from `.claude/agents/*` when the manifest doesn't list its own.
 * Sets `model.manifest` only if there's something to show.
 */
export function applyManifest(root: string, model: { manifest?: ProjectManifest }): void {
  const manifest = readManifest(root) ?? {};
  if (!manifest.agents?.length) {
    const agents = detectAgents(root);
    if (agents.length) manifest.agents = agents;
  }
  const has = Object.values(manifest).some((v) => (Array.isArray(v) ? v.length : v != null));
  if (has) model.manifest = manifest;
}

/** Starter manifest content for `project --init` / `init`. */
export function starterManifest(project: string): string {
  const tpl: ProjectManifest = {
    goal: `What ${project} is for — one paragraph. Edit me.`,
    status: "active",
    author: { name: "" },
    links: [],
    history: [],
  };
  return JSON.stringify(tpl, null, 2) + "\n";
}

/** Write a starter `.archmantic/project.json` if absent. Returns true if created. */
export function scaffoldManifest(root: string, project: string): boolean {
  const p = join(root, MANIFEST_PATH);
  if (existsSync(p)) return false;
  mkdirSync(join(root, ".archmantic"), { recursive: true });
  writeFileSync(p, starterManifest(project), "utf8");
  return true;
}
