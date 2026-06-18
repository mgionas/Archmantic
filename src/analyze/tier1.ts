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
import { classifyExternal } from "./stack.js";

const NODE_BUILTINS = new Set([
  "fs", "path", "os", "http", "https", "crypto", "events", "stream", "util",
  "url", "child_process", "net", "tls", "zlib", "buffer", "process", "assert",
  "readline", "worker_threads", "dns", "module",
]);

function scriptKindFor(rel: string): ts.ScriptKind {
  if (rel.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (rel.endsWith(".ts")) return ts.ScriptKind.TS;
  if (rel.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (rel.endsWith(".vue")) return ts.ScriptKind.TS; // parse the SFC <script> block as TS
  return ts.ScriptKind.JS;
}

/** A Vue SFC's import graph lives in its `<script>` block(s); extract just those. */
function vueScript(text: string): string {
  const blocks: string[] = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) blocks.push(m[1]!);
  return blocks.join("\n");
}

const compId = (rel: string) => `comp:${rel}`;
const isBuiltin = (pkg: string) => NODE_BUILTINS.has(pkg);

/** Build the System node for an external dependency (bare or `node:` specifier).
 *  Classified (datastore/saas/infra/library/runtime) so projections can draw real
 *  systems and demote libraries/runtime to the Technologies page. */
export function buildExternalSystem(name: string, builtin: boolean): System {
  const externalKind = classifyExternal(name, builtin);
  const desc =
    externalKind === "runtime"
      ? "Node.js runtime/builtin module"
      : externalKind === "library"
        ? "External library"
        : "External system";
  return {
    id: `sys:ext:${name}`,
    name,
    kind: "external",
    externalKind,
    description: desc,
    provenance: [{ source: "code", ref: name, confidence: STRUCTURAL_CONFIDENCE }],
    confidence: STRUCTURAL_CONFIDENCE,
  };
}

/** Resolve a repo-relative module base to a known source file, trying the usual
 *  extension + index fallbacks (NodeNext `.js`→`.ts`, extensionless, `/index.*`). */
function resolveModuleBase(base: string, fileSet: Set<string>): string | undefined {
  const norm = base.split("\\").join("/").replace(/^\.\//, "");
  const stem = norm.replace(/\.(js|jsx|mjs|cjs)$/, "");
  const candidates = [
    norm,
    `${stem}.ts`, `${stem}.tsx`, `${stem}.js`, `${stem}.jsx`, `${stem}.mjs`, `${stem}.cjs`, `${stem}.vue`,
    `${stem}/index.ts`, `${stem}/index.tsx`, `${stem}/index.js`,
  ];
  for (const c of candidates) if (fileSet.has(c)) return c;
  return undefined;
}

/** Resolve a relative import specifier to a known source file (component). */
function resolveInternal(importerRel: string, spec: string, fileSet: Set<string>): string | undefined {
  return resolveModuleBase(join(dirname(importerRel), spec).split("\\").join("/"), fileSet);
}

/** A tsconfig/jsconfig path alias: a pattern (e.g. `@/*`) → repo-relative targets. */
export interface PathAlias {
  pattern: string;
  targets: string[];
}

/** Read `compilerOptions.paths` (+ `baseUrl`) from tsconfig.json / jsconfig.json so
 *  alias imports (`@/lib`, `~/components`) resolve to internal files instead of being
 *  mistaken for npm packages. Uses the TS config reader (tolerates comments). */
export function loadAliases(root: string): PathAlias[] {
  for (const name of ["tsconfig.json", "jsconfig.json"]) {
    const file = join(root, name);
    let raw: string;
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const parsed = ts.readConfigFile(file, () => raw).config as
      | { compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> } }
      | undefined;
    const co = parsed?.compilerOptions;
    if (!co?.paths) continue;
    const baseUrl = co.baseUrl ?? ".";
    const aliases: PathAlias[] = [];
    for (const [pattern, targets] of Object.entries(co.paths)) {
      if (!Array.isArray(targets)) continue;
      aliases.push({ pattern, targets: targets.map((t) => join(baseUrl, t).split("\\").join("/")) });
    }
    if (aliases.length) return aliases;
  }
  return [];
}

/** Resolve a non-relative specifier via tsconfig path aliases to an internal file. */
function resolveAlias(spec: string, aliases: PathAlias[], fileSet: Set<string>): string | undefined {
  for (const { pattern, targets } of aliases) {
    const star = pattern.indexOf("*");
    if (star === -1) {
      if (spec !== pattern) continue;
      for (const t of targets) {
        const hit = resolveModuleBase(t, fileSet);
        if (hit) return hit;
      }
      continue;
    }
    const pre = pattern.slice(0, star);
    const post = pattern.slice(star + 1);
    if (!spec.startsWith(pre) || !spec.endsWith(post) || spec.length < pre.length + post.length) continue;
    const captured = spec.slice(pre.length, spec.length - post.length);
    for (const t of targets) {
      const hit = resolveModuleBase(t.replace("*", captured), fileSet);
      if (hit) return hit;
    }
  }
  return undefined;
}

export interface FileEdges {
  /** Outgoing depends_on relations from this file. */
  edges: Relation[];
  /** External systems this file references (deduped within the file). */
  externals: System[];
}

/** Extract one file's outgoing import edges + referenced external systems. */
export function extractFileEdges(root: string, rel: string, fileSet: Set<string>, aliases: PathAlias[] = []): FileEdges {
  const edges = new Map<string, Relation>();
  const externals = new Map<string, System>();
  const fromId = compId(rel);

  let text: string;
  try {
    text = readFileSync(join(root, rel), "utf8");
  } catch {
    return { edges: [], externals: [] };
  }
  if (rel.endsWith(".vue")) text = vueScript(text);
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
      // A tsconfig path alias (e.g. `@/lib`, `~/components`) is internal, not an npm
      // package — resolve it to a file before falling back to an external system.
      const aliased = resolveAlias(spec, aliases, fileSet);
      if (aliased) {
        addRelation(compId(aliased), prov);
        return;
      }
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
  const aliases = loadAliases(root);
  const externals = new Map<string, System>();

  for (const rel of sourceFiles) {
    const { edges, externals: exts } = extractFileEdges(root, rel, fileSet, aliases);
    for (const e of edges) model.relations.push(e);
    for (const s of exts) if (!externals.has(s.id)) externals.set(s.id, s);
  }
  for (const s of externals.values()) model.systems.push(s);
}
