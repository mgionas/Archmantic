/**
 * Analysis pipeline orchestrator (tiered, cheapest-first).
 * v1: Tier 0 (repo structure) + Tier 1 (TS/JS static analysis). Tier 2 (LLM)
 * and Tier 3 (runtime) come later. See docs/ARCHITECTURE.md §3.
 */
import { type ArchitectureModel } from "../ir/types.js";
import { walkSourceFiles } from "./walk.js";
import { tier0 } from "./tier0.js";
import { tier1 } from "./tier1.js";
import { deriveSemantics } from "./derive.js";

export function analyzeRepo(root: string): ArchitectureModel {
  const files = walkSourceFiles(root);
  const model = tier0(root, files);
  tier1(root, files, model);
  deriveSemantics(root, files, model);
  return model;
}

export { walkSourceFiles };
