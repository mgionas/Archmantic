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
import { detectDataModel } from "./prisma.js";

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

export function analyzeRepo(root: string): ArchitectureModel {
  const files = walkSourceFiles(root);
  const model = tier0(root, files);
  tier1(root, files, model);
  deriveSemantics(root, files, model);
  model.technologies = detectStack(root);
  model.dataEntities = detectDataModel(root);
  applyConfig(root, model);
  return model;
}

export { walkSourceFiles };
