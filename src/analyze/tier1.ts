/**
 * Tier 1 — deterministic static analysis (TS/JS).
 *
 * v1 uses the TypeScript compiler API (we already depend on `typescript`) rather
 * than tree-sitter: more accurate for TS/JS, zero extra deps. tree-sitter is
 * introduced when we add other languages (post-MVP).
 *
 * Extracts module-level import/re-export edges → `depends_on` relations, each
 * grounded with `file:line` provenance. Internal imports resolve to Components;
 * bare/builtin imports become external Systems. The per-file extractor
 * (`extractFileEdges`) is reused by the incremental updater (M6).
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

const compId = (rel: string) => `comp:${rel}`;
const isBuiltin = (pkg: string) => NODE_BUILTINS.has(pkg);

/** Build the System node for an external dependency (bare or `node:` specifier). */
export function buildExternalSystem(name: string, builtin: boolean): System {
  return {
    id: `sys:ext:${name}`,
    name,
    kind: "external",
    description: builtin ? "Node.js runtime/builtin module" : "External dependency",
    provenance: [{ source: "code", ref: name, confidence: STRUCTURAL_CONFIDENCE }],
    confidence: STRUCTURAL_CONFIDENCE,
  };
}

/** Resolve a relative import specifier to a known source file (component). */
function resolveInternal(importerRel: string, spec: string, fileSet: Set<string>): string | undefined {
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

export interface FileEdges {
  /** Outgoing depends_on relations from this file. */
  edges: Relation[];
  /** External systems this file references (deduped within the file). */
  externals: System[];
}

/** Extract one file's outgoing import edges + referenced external systems. */
export function extractFileEdges(root: string, rel: string, fileSet: Set<string>): FileEdges {
  const edges = new Map<string, Relation>();
  const externals = new Map<string, System>();
  const fromId = compId(rel);

  let text: string;
  try {
    text = readFileSync(join(root, rel), "utf8");
  } catch {
    return { edges: [], externals: [] };
  }
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, scriptKindFor(rel));

  const addRelation = (toId: string, prov: Provenance): void => {
    const existing = edges.get(toId);
    if (existing) {
      existing.provenance.push(prov);
      return;
    }
    edges.set(toId, {
      id: `rel:${fromId}=>${toId}`,
      name: `${fromId} → ${toId}`,
      kind: "depends_on",
      from: fromId,
      to: toId,
      provenance: [prov],
      confidence: STRUCTURAL_CONFIDENCE,
    });
  };

  const ensureExternal = (name: string, builtin: boolean): string => {
    const sys = buildExternalSystem(name, builtin);
    if (!externals.has(sys.id)) externals.set(sys.id, sys);
    return sys.id;
  };

  const handle = (spec: string, node: ts.Node): void => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    const prov: Provenance = { source: "code", ref: `${rel}:${line}`, confidence: STRUCTURAL_CONFIDENCE };
    if (spec.startsWith(".")) {
      const target = resolveInternal(rel, spec, fileSet);
      if (target) addRelation(compId(target), prov);
      // unresolved relative imports (e.g. ../package.json) are skipped in v1
    } else if (spec.startsWith("node:")) {
      addRelation(ensureExternal(spec, true), prov);
    } else {
      const pkg = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]!;
      addRelation(ensureExternal(pkg, isBuiltin(pkg)), prov);
    }
  };

  sf.forEachChild((node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      handle(node.moduleSpecifier.text, node);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      handle(node.moduleSpecifier.text, node);
    }
  });

  return { edges: [...edges.values()], externals: [...externals.values()] };
}

export function tier1(root: string, sourceFiles: string[], model: ArchitectureModel): void {
  const fileSet = new Set(sourceFiles);
  const externals = new Map<string, System>();

  for (const rel of sourceFiles) {
    const { edges, externals: exts } = extractFileEdges(root, rel, fileSet);
    for (const e of edges) model.relations.push(e);
    for (const s of exts) if (!externals.has(s.id)) externals.set(s.id, s);
  }
  for (const s of externals.values()) model.systems.push(s);
}
