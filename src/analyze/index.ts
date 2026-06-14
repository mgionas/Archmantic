/**
 * Analysis pipeline orchestrator (tiered, cheapest-first).
 * Tier 0 (repo structure) + 0.5 (tech stack) + Tier 1 (TS/JS static analysis) +
 * structural derivation. Tier 2 (LLM) and Tier 3 (runtime) come later.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type ArchitectureModel } from "../ir/types.js";
import { walkSourceFiles } from "./walk.js";
import { tier0 } from "./tier0.js";
import { tier1 } from "./tier1.js";
import { deriveSemantics } from "./derive.js";
import { detectStack } from "./stack.js";
import { detectDataModel } from "./datamodel.js";
import { detectEndpoints } from "./endpoints.js";
import { detectLaravelRoutes } from "./laravel.js";
import { detectLaravelViews } from "./laravel-views.js";
import { refineRole, needsRefine } from "./roles.js";
import { detectWorkspaces, packageOf } from "./workspaces.js";
import { applyManifest } from "../project/manifest.js";
import { detectFeatures } from "../project/features.js";

/** Upgrade weak path-derived component roles using file content signals. */
function refineRoles(root: string, model: ArchitectureModel): void {
  for (const c of model.components) {
    if (!needsRefine(c.role ?? "module")) continue;
    const rel = c.id.replace(/^comp:/, "");
    try {
      c.role = refineRole(rel, readFileSync(join(root, rel), "utf8"), c.role ?? "module");
    } catch {
      /* unreadable — keep path role */
    }
  }
}

/**
 * Monorepo: tag each element with its owning workspace member so the model — one
 * model per repo — stays navigable by package (web grouping, MCP answers). The
 * file path comes from the component id (`comp:<rel>`) or the first provenance ref.
 */
function tagPackages(model: ArchitectureModel, members: string[]): void {
  if (!members.length) return;
  model.workspaces = members;
  const refPath = (el: { provenance?: { ref?: string }[] }): string | undefined =>
    el.provenance?.[0]?.ref?.split(":")[0];
  const tag = (el: { package?: string }, rel: string | undefined): void => {
    const p = rel ? packageOf(rel, members) : undefined;
    if (p) el.package = p;
  };
  for (const c of model.components) tag(c, c.id.replace(/^comp:/, ""));
  for (const e of model.endpoints) tag(e, refPath(e));
  for (const e of model.dataEntities) tag(e, refPath(e));
}

/** Read optional `.archmantic/config.json` → multi-repo system + project overrides. */
function applyConfig(root: string, model: ArchitectureModel): void {
  const p = join(root, ".archmantic", "config.json");
  if (!existsSync(p)) return;
  try {
    const cfg = JSON.parse(readFileSync(p, "utf8")) as { project?: string; system?: string; consumes?: string[] };
    if (cfg.project) model.project = cfg.project;
    if (cfg.system) model.system = cfg.system;
    if (Array.isArray(cfg.consumes)) model.consumes = cfg.consumes;
  } catch {
    /* ignore malformed config */
  }
}

/** Merge endpoint sets from multiple detectors, de-duplicating by id (first wins). */
function mergeEndpoints(...sets: ArchitectureModel["endpoints"][]): ArchitectureModel["endpoints"] {
  const seen = new Set<string>();
  const out: ArchitectureModel["endpoints"] = [];
  for (const set of sets)
    for (const e of set)
      if (!seen.has(e.id)) {
        seen.add(e.id);
        out.push(e);
      }
  return out;
}

export function analyzeRepo(root: string): ArchitectureModel {
  const files = walkSourceFiles(root);
  const model = tier0(root, files);
  tier1(root, files, model);
  deriveSemantics(root, files, model);
  // Blade/Livewire UI lives in .php (outside the JS walk) — add as components.
  for (const c of detectLaravelViews(root)) {
    if (!model.components.some((existing) => existing.id === c.id)) model.components.push(c);
  }
  model.technologies = detectStack(root);
  model.dataEntities = detectDataModel(root);
  model.endpoints = mergeEndpoints(detectEndpoints(root), detectLaravelRoutes(root));
  refineRoles(root, model);
  tagPackages(model, detectWorkspaces(root));
  applyConfig(root, model);
  applyManifest(root, model);
  model.features = detectFeatures(root, model);
  return model;
}

export { walkSourceFiles };
