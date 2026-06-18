/**
 * M6 — incremental update on change. Instead of re-analyzing the whole repo, use
 * git to find what changed and patch only those files into the existing IR:
 *
 *   - changed/added files → re-extract their components, edges, capabilities
 *   - deleted files       → drop their components, edges (incl. dangling targets),
 *                           and capabilities
 *   - external systems    → rebuilt from the surviving + new edges
 *   - process / flow      → re-derived (cheap: one graph traversal)
 *
 * Falls back to a full recompute when git isn't available. The result is
 * equivalent (same element id sets) to a clean `analyze`, just faster.
 */
import { execFileSync } from "node:child_process";
import { type ArchitectureModel } from "../ir/types.js";
import { walkSourceFiles } from "./walk.js";
import { componentFor } from "./tier0.js";
import { extractFileEdges, buildExternalSystem } from "./tier1.js";
import { extractFileCapabilities, deriveProcessAndFlow } from "./derive.js";
import { detectStack } from "./stack.js";
import { deriveGroups } from "./groups.js";
import { readCuration, applyCuration } from "../project/curation.js";

const relOf = (id: string) => id.slice(id.indexOf(":") + 1);

export interface IncrementalResult {
  model: ArchitectureModel;
  /** Files re-analyzed (changed or newly added). */
  recomputed: string[];
  /** Files dropped from the model (deleted on disk). */
  removed: string[];
  /** True when git was unavailable and every file was recomputed. */
  fullFallback: boolean;
}

/** Source files changed vs HEAD (tracked) plus untracked new files; null if no git. */
function gitChangedFiles(root: string): string[] | null {
  try {
    const tracked = execFileSync("git", ["-C", root, "diff", "--name-only", "HEAD"], { encoding: "utf8" });
    const untracked = execFileSync("git", ["-C", root, "ls-files", "--others", "--exclude-standard"], {
      encoding: "utf8",
    });
    return [...tracked.split("\n"), ...untracked.split("\n")].map((s) => s.trim()).filter(Boolean);
  } catch {
    return null;
  }
}

export function incrementalUpdate(root: string, base: ArchitectureModel): IncrementalResult {
  const current = walkSourceFiles(root);
  const currentSet = new Set(current);
  const baseFiles = base.components.map((c) => relOf(c.id));
  const baseSet = new Set(baseFiles);

  const removed = baseFiles.filter((f) => !currentSet.has(f));
  const removedSet = new Set(removed);

  const gitChanged = gitChangedFiles(root);
  let recomputed: string[];
  let fullFallback = false;
  if (!gitChanged) {
    recomputed = [...current];
    fullFallback = true;
  } else {
    const changed = new Set(gitChanged);
    recomputed = current.filter((f) => changed.has(f) || !baseSet.has(f));
  }
  const recomputedSet = new Set(recomputed);
  const drop = new Set([...removed, ...recomputed]); // files whose elements are rebuilt or removed

  const model: ArchitectureModel = structuredClone(base);
  const internalSystemId = base.systems.find((s) => s.kind === "internal")?.id ?? `sys:${base.project}`;

  // --- Components: keep untouched survivors; re-add recomputed ---
  model.components = model.components.filter((c) => {
    const f = relOf(c.id);
    return currentSet.has(f) && !drop.has(f);
  });
  for (const f of recomputed) model.components.push(componentFor(f, internalSystemId));

  // --- Relations: drop those from rebuilt/removed files or pointing at removed files; re-add recomputed ---
  model.relations = model.relations.filter((r) => {
    if (drop.has(relOf(r.from))) return false;
    if (r.to.startsWith("comp:") && removedSet.has(relOf(r.to))) return false;
    return true;
  });
  for (const f of recomputed) {
    const { edges } = extractFileEdges(root, f, currentSet);
    for (const e of edges) model.relations.push(e);
  }

  // --- External systems: rebuild from surviving edges (reuse base metadata) ---
  const referencedExt = new Set(model.relations.filter((r) => r.to.startsWith("sys:ext:")).map((r) => r.to));
  const baseExt = new Map(base.systems.filter((s) => s.kind === "external").map((s) => [s.id, s]));
  const internal = base.systems.find((s) => s.kind === "internal");
  model.systems = internal ? [structuredClone(internal)] : [];
  for (const id of [...referencedExt].sort()) {
    const name = id.slice("sys:ext:".length);
    model.systems.push(structuredClone(baseExt.get(id) ?? buildExternalSystem(name, name.startsWith("node:"))));
  }

  // --- Capabilities: keep untouched survivors; re-add recomputed ---
  model.capabilities = model.capabilities.filter((cap) => {
    const f = relOf(cap.componentIds[0] ?? "");
    return currentSet.has(f) && !drop.has(f);
  });
  for (const f of recomputed) for (const cap of extractFileCapabilities(root, f)) model.capabilities.push(cap);

  // --- Tech stack: cheap re-detect from package.json ---
  model.technologies = detectStack(root);

  // --- Semantic groups + curation overlay: cheap full re-derive over the patched components ---
  deriveGroups(model, model.workspaces ?? []);
  applyCuration(model, readCuration(root));

  // --- Process + flow: cheap full re-derive over the patched graph ---
  deriveProcessAndFlow(root, model);

  return { model, recomputed: [...recomputedSet], removed, fullFallback };
}
