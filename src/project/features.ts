/**
 * Feature layer (Spec layer Phase 2) — the user-perspective definition of what
 * the product does: each feature's description, what it shows, what the user can
 * do, what it depends on, and which components implement it.
 *
 * Features are authored as `.archmantic/features/<slug>.md` (frontmatter +
 * `## Shows` / `## Actions` sections) — git-versioned, agent-editable, provenance
 * human. When no file exists, features are seeded bottom-up from page/route
 * components (provenance code, status "draft") so there's something to refine.
 * Authored files always win over seeds. See docs/design/SPEC-LAYER.md.
 */
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type ArchitectureModel, type Feature, type FeatureShow, type FeatureAction } from "../ir/types.js";
import { componentLabel, humanize } from "../ir/naming.js";
import { isTestFile } from "../analyze/fs-util.js";

export const FEATURES_DIR = join(".archmantic", "features");
const HUMAN_CONFIDENCE = 0.9;
const SEED_CONFIDENCE = 0.55;

export const slugify = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "feature";

const featureId = (nameOrSlug: string): string => `feature:${slugify(nameOrSlug)}`;

/**
 * A readable, collision-resistant feature name for a page/route component. Uses
 * the path *after* a `pages/` segment so sibling `add.vue`/`show.vue` don't all
 * collapse to "Add"/"Show"; keeps the last two segments (dropping `index`).
 */
function featureNameFor(rel: string): string {
  let parts = rel.replace(/\.(blade\.php|vue|tsx|ts|jsx|js|mjs|cjs)$/, "").split("/");
  const pi = parts.findIndex((p) => /^pages$/i.test(p));
  if (pi >= 0) parts = parts.slice(pi + 1);
  if (parts[parts.length - 1]?.toLowerCase() === "index") parts.pop();
  const tail = parts.slice(-2).join(" ");
  return humanize(tail) || componentLabel(`comp:${rel}`);
}

/** Parse a comma/inline-array list from a frontmatter value: `[a, b]` or `a, b`. */
function parseList(raw: string): string[] {
  return raw
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

/** Parse one feature markdown file into a Feature. */
export function parseFeatureFile(text: string, slug: string): Feature {
  let name = slug;
  let body = text;
  const dependsOn: string[] = [];
  const components: string[] = [];
  let status: string | undefined;

  const fm = /^---\s*\n([\s\S]*?)\n---\s*\n?/.exec(text);
  if (fm) {
    body = text.slice(fm[0].length);
    for (const line of fm[1]!.split("\n")) {
      const kv = /^([A-Za-z_]+)\s*:\s*(.+?)\s*$/.exec(line);
      if (!kv) continue;
      const key = kv[1]!.toLowerCase();
      const val = kv[2]!;
      if (key === "name") name = val.replace(/^['"]|['"]$/g, "");
      else if (key === "status") status = val;
      else if (key === "dependson") dependsOn.push(...parseList(val).map(featureId));
      else if (key === "components") components.push(...parseList(val).map((c) => (c.startsWith("comp:") ? c : `comp:${c}`)));
    }
  }

  // Body: text before the first `##` is the description; then Shows / Actions.
  const shows: FeatureShow[] = [];
  const actions: FeatureAction[] = [];
  const descLines: string[] = [];
  let section: "desc" | "shows" | "actions" = "desc";
  for (const raw of body.split("\n")) {
    const h = /^##\s+(.+?)\s*$/.exec(raw);
    if (h) {
      const t = h[1]!.toLowerCase();
      section = t.startsWith("show") ? "shows" : t.startsWith("action") ? "actions" : "desc";
      continue;
    }
    const item = /^[-*]\s+(.+?)\s*$/.exec(raw);
    if (section === "shows" && item) {
      const m = /^(.*?)\s*\((?:from\s+)?([^)]+)\)\s*$/.exec(item[1]!);
      shows.push(m ? { text: m[1]!.trim(), source: m[2]!.trim() } : { text: item[1]! });
    } else if (section === "actions" && item) {
      const m = /^(.*?)\s*(?:—|--|:)\s*(.+)$/.exec(item[1]!);
      actions.push(m ? { name: m[1]!.trim(), description: m[2]!.trim() } : { name: item[1]! });
    } else if (section === "desc") {
      descLines.push(raw);
    }
  }
  const description = descLines.join("\n").trim() || undefined;

  const f: Feature = {
    id: featureId(slug),
    name,
    description,
    provenance: [{ source: "human", ref: join(FEATURES_DIR, `${slug}.md`), confidence: HUMAN_CONFIDENCE }],
    confidence: HUMAN_CONFIDENCE,
  };
  if (shows.length) f.shows = shows;
  if (actions.length) f.actions = actions;
  if (dependsOn.length) f.dependsOn = [...new Set(dependsOn)];
  if (components.length) f.components = [...new Set(components)];
  if (status) f.status = status;
  return f;
}

/** Read all authored feature files from `.archmantic/features/`. */
export function readFeatures(root: string): Feature[] {
  const dir = join(root, FEATURES_DIR);
  let files: string[];
  try {
    files = readdirSync(dir).filter((n) => n.endsWith(".md"));
  } catch {
    return [];
  }
  const out: Feature[] = [];
  for (const file of files.sort()) {
    try {
      out.push(parseFeatureFile(readFileSync(join(dir, file), "utf8"), file.replace(/\.md$/, "")));
    } catch {
      /* skip unparseable */
    }
  }
  return out;
}

/**
 * Seed candidate features bottom-up from page/route components — one per page, so
 * a fresh repo has a starting set to refine. Status "draft", provenance code.
 */
export function seedFeatures(model: ArchitectureModel): Feature[] {
  const bySlug = new Map<string, Feature>();
  for (const c of model.components) {
    const role = c.role ?? "module";
    if (role !== "page" && role !== "route" && role !== "view") continue;
    const rel = c.id.replace(/^comp:/, "");
    if (isTestFile(rel)) continue; // tests/fixtures aren't features
    const name = featureNameFor(rel);
    const slug = slugify(name);
    const existing = bySlug.get(slug);
    if (existing) {
      existing.components = [...new Set([...(existing.components ?? []), c.id])];
      continue;
    }
    bySlug.set(slug, {
      id: featureId(slug),
      name,
      description: c.responsibility ?? `${name} ${role}.`,
      components: [c.id],
      status: "draft",
      provenance: [{ source: "code", ref: c.id.replace(/^comp:/, ""), confidence: SEED_CONFIDENCE }],
      confidence: SEED_CONFIDENCE,
    });
  }
  return [...bySlug.values()];
}

/** Authored features win over seeds (by id); seeds fill the rest. */
export function mergeFeatures(authored: Feature[], seeded: Feature[]): Feature[] {
  const byId = new Map<string, Feature>();
  for (const f of seeded) byId.set(f.id, f);
  for (const f of authored) byId.set(f.id, f); // authored overrides
  return [...byId.values()];
}

/** Resolve features for the model: authored files merged over bottom-up seeds. */
export function detectFeatures(root: string, model: ArchitectureModel): Feature[] {
  return mergeFeatures(readFeatures(root), seedFeatures(model));
}

/** Render a Feature as an editable `.archmantic/features/<slug>.md` file. */
export function featureFileMarkdown(f: Feature, nameOf: (id: string) => string): string {
  const fm: string[] = [`name: ${f.name}`];
  if (f.status) fm.push(`status: ${f.status}`);
  if (f.dependsOn?.length) fm.push(`dependsOn: [${f.dependsOn.map(nameOf).join(", ")}]`);
  if (f.components?.length) fm.push(`components: [${f.components.map((c) => c.replace(/^comp:/, "")).join(", ")}]`);
  const out = [`---`, ...fm, `---`, ``, f.description ?? "Describe this feature.", ``];
  out.push(`## Shows`);
  for (const s of f.shows ?? []) out.push(`- ${s.text}${s.source ? ` (from ${s.source})` : ""}`);
  out.push(``, `## Actions`);
  for (const a of f.actions ?? []) out.push(`- ${a.name}${a.description ? ` — ${a.description}` : ""}`);
  out.push(``);
  return out.join("\n");
}

/**
 * Write seed feature files into `.archmantic/features/` for refinement — only for
 * features that don't already have a file. Returns the slugs written.
 */
export function seedFeatureFiles(root: string, model: ArchitectureModel): string[] {
  const dir = join(root, FEATURES_DIR);
  mkdirSync(dir, { recursive: true });
  const nameById = new Map<string, string>();
  for (const f of model.features) nameById.set(f.id, f.name);
  const nameOf = (id: string) => nameById.get(id) ?? id.replace(/^feature:/, "");
  const written: string[] = [];
  for (const f of model.features) {
    const slug = f.id.replace(/^feature:/, "");
    const file = join(dir, `${slug}.md`);
    if (existsSync(file)) continue;
    writeFileSync(file, featureFileMarkdown(f, nameOf), "utf8");
    written.push(slug);
  }
  return written;
}
