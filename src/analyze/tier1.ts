/**
 * Tier 1 — deterministic static analysis (TS/JS).
 *
 * v1 uses the TypeScript compiler API (we already depend on `typescript`) rather
 * than tree-sitter: more accurate for TS/JS, zero extra deps. tree-sitter is
 * introduced when we add other languages (post-MVP).
 *
 * Extracts module-level import/re-export edges → `depends_on` relations, each
 * grounded with `file:line` provenance. Internal imports resolve to Components;
 * bare/builtin imports become external Systems.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import ts from "typescript";
import { type ArchitectureModel, type Provenance, type Relation, type System } from "../ir/types.js";
import { STRUCTURAL_CONFIDENCE } from "./tier0.js";

const NODE_BUILTINS = new Set([
  "fs", "path", "os", "http", "https", "crypto", "events", "stream", "util",
  "url", "child_process", "net", "tls", "zlib", "buffer", "process", "assert",
  "readline", "worker_threads", "dns", "module",
]);

function scriptKindFor(rel: string): ts.ScriptKind {
  if (rel.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (rel.endsWith(".ts")) return ts.ScriptKind.TS;
  if (rel.endsWith(".jsx")) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

export function tier1(root: string, sourceFiles: string[], model: ArchitectureModel): void {
  const fileSet = new Set(sourceFiles);
  const relations = new Map<string, Relation>();
  const externals = new Map<string, System>();

  const compId = (rel: string) => `comp:${rel}`;

  function ensureExternal(name: string, builtin: boolean): string {
    const id = `sys:ext:${name}`;
    if (!externals.has(id)) {
      externals.set(id, {
        id,
        name,
        kind: "external",
        description: builtin ? "Node.js runtime/builtin module" : "External dependency",
        provenance: [{ source: "code", ref: name, confidence: STRUCTURAL_CONFIDENCE }],
        confidence: STRUCTURAL_CONFIDENCE,
      });
    }
    return id;
  }

  /** Resolve a relative import specifier to a known source file (component). */
  function resolveInternal(importerRel: string, spec: string): string | undefined {
    const base = join(dirname(importerRel), spec).split("\\").join("/");
    // NodeNext/ESM imports carry a `.js`-family extension that maps to the `.ts`
    // source on disk (`./walk.js` → `walk.ts`); also try the extensionless stem.
    const stem = base.replace(/\.(js|jsx|mjs|cjs)$/, "");
    const candidates = [
      base,
      `${stem}.ts`, `${stem}.tsx`, `${stem}.js`, `${stem}.jsx`, `${stem}.mjs`, `${stem}.cjs`,
      `${stem}/index.ts`, `${stem}/index.tsx`, `${stem}/index.js`,
    ];
    for (const c of candidates) if (fileSet.has(c)) return c;
    return undefined;
  }

  function addRelation(fromId: string, toId: string, prov: Provenance): void {
    const key = `${fromId}|${toId}`;
    const existing = relations.get(key);
    if (existing) {
      existing.provenance.push(prov);
      return;
    }
    relations.set(key, {
      id: `rel:${fromId}=>${toId}`,
      name: `${fromId} → ${toId}`,
      kind: "depends_on",
      from: fromId,
      to: toId,
      provenance: [prov],
      confidence: STRUCTURAL_CONFIDENCE,
    });
  }

  for (const rel of sourceFiles) {
    let text: string;
    try {
      text = readFileSync(join(root, rel), "utf8");
    } catch {
      continue;
    }
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, scriptKindFor(rel));
    const fromId = compId(rel);

    const handle = (spec: string, node: ts.Node): void => {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      const prov: Provenance = { source: "code", ref: `${rel}:${line}`, confidence: STRUCTURAL_CONFIDENCE };
      if (spec.startsWith(".")) {
        const target = resolveInternal(rel, spec);
        if (target) addRelation(fromId, compId(target), prov);
        // unresolved relative imports (e.g. ../package.json) are skipped in v1
      } else if (spec.startsWith("node:")) {
        addRelation(fromId, ensureExternal(spec, true), prov);
      } else {
        const pkg = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]!;
        addRelation(fromId, ensureExternal(pkg, NODE_BUILTINS.has(pkg)), prov);
      }
    };

    sf.forEachChild((node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        handle(node.moduleSpecifier.text, node);
      } else if (
        ts.isExportDeclaration(node) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        handle(node.moduleSpecifier.text, node);
      }
    });
  }

  for (const s of externals.values()) model.systems.push(s);
  for (const r of relations.values()) model.relations.push(r);
}
