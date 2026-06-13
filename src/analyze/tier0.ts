/**
 * Tier 0 — cheapest analysis: repo structure + manifests.
 * Produces the internal System + one Component per source file, each grounded
 * with provenance. No code parsing yet (that's Tier 1).
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { type ArchitectureModel, createEmptyModel } from "../ir/types.js";

/** Confidence for deterministic structural facts (Tier 0/1). */
export const STRUCTURAL_CONFIDENCE = 0.95;

interface PackageJson {
  name?: string;
  description?: string;
}

export function tier0(root: string, sourceFiles: string[]): ArchitectureModel {
  const pkgPath = join(root, "package.json");
  const hasPkg = existsSync(pkgPath);
  let pkg: PackageJson = {};
  if (hasPkg) {
    try {
      pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as PackageJson;
    } catch {
      /* leave pkg empty on malformed package.json */
    }
  }

  const projectName = pkg.name ?? basename(root);
  const model = createEmptyModel(projectName);
  const systemId = `sys:${projectName}`;

  model.systems.push({
    id: systemId,
    name: projectName,
    kind: "internal",
    description: pkg.description ?? (hasPkg ? "Project root" : "Project root (inferred from folder name)"),
    provenance: [
      { source: "repo", ref: hasPkg ? "package.json:1" : ".", confidence: STRUCTURAL_CONFIDENCE },
    ],
    confidence: STRUCTURAL_CONFIDENCE,
  });

  for (const rel of sourceFiles) {
    model.components.push({
      id: `comp:${rel}`,
      name: rel,
      kind: "module",
      systemId,
      provenance: [{ source: "code", ref: `${rel}:1`, confidence: STRUCTURAL_CONFIDENCE }],
      confidence: STRUCTURAL_CONFIDENCE,
    });
  }

  return model;
}
