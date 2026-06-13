/**
 * Tier 1.5 — deterministic semantic derivation (no LLM yet; that's Tier 2 / M4).
 *
 * Two structural products, both grounded with `file:line` provenance:
 *   - Capabilities: exported functions/classes → "what can this system do?"
 *     (USP 1). Naming intent is heuristic, so these carry a *lower* confidence
 *     and are flagged for the Tier-2 LLM pass to refine.
 *   - One Process + one Flow: the dependency chain orchestrated from the main
 *     entry point → a BPMN process (USP 2) and a sequence (one model, many views).
 *
 * Everything here is reproducible from the AST + import graph; the LLM later
 * rewrites the prose and raises confidence, it does not invent structure.
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import ts from "typescript";
import {
  type ArchitectureModel,
  type Capability,
  type Flow,
  type FlowStep,
  type Process,
  type Provenance,
} from "../ir/types.js";
import { componentLabel, humanize } from "../ir/naming.js";

/**
 * The export exists deterministically (file:line); only its plain-English
 * reading is heuristic. Medium confidence: real and grounded, prose refined by
 * the Tier-2 LLM pass. (Reserve the low/⚠ band for genuinely uncertain finds.)
 */
export const HEURISTIC_CONFIDENCE = 0.6;

/** Cap process/flow length so a huge graph still yields a readable diagram. */
const MAX_PROCESS_TASKS = 12;

function scriptKindFor(rel: string): ts.ScriptKind {
  if (rel.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (rel.endsWith(".ts")) return ts.ScriptKind.TS;
  if (rel.endsWith(".jsx")) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

function hasExport(node: ts.Node): boolean {
  return (ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined)?.some(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword,
  ) ?? false;
}

interface ExportedSymbol {
  name: string;
  kind: "function" | "class";
  line: number;
}

/** Collect top-level exported functions/classes (the value-level public surface). */
function collectExports(sf: ts.SourceFile): ExportedSymbol[] {
  const out: ExportedSymbol[] = [];
  const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  sf.forEachChild((node) => {
    if (!hasExport(node)) return;
    if (ts.isFunctionDeclaration(node) && node.name) {
      out.push({ name: node.name.text, kind: "function", line: lineOf(node) });
    } else if (ts.isClassDeclaration(node) && node.name) {
      out.push({ name: node.name.text, kind: "class", line: lineOf(node) });
    } else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.initializer &&
          (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
        ) {
          out.push({ name: decl.name.text, kind: "function", line: lineOf(decl) });
        }
      }
    }
  });
  return out;
}

/** Map the package.json bin/main entry to a known component path, else a sensible default. */
function findEntryComponent(root: string, componentPaths: string[]): string | undefined {
  const set = new Set(componentPaths);
  const fromManifest = (): string | undefined => {
    const pkgPath = join(root, "package.json");
    if (!existsSync(pkgPath)) return undefined;
    let pkg: { bin?: string | Record<string, string>; main?: string } = {};
    try {
      pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    } catch {
      return undefined;
    }
    const binVal = typeof pkg.bin === "string" ? pkg.bin : Object.values(pkg.bin ?? {})[0];
    for (const hint of [binVal, pkg.main]) {
      if (!hint) continue;
      const base = basename(hint).replace(/\.(js|mjs|cjs)$/, "");
      const match = componentPaths.find((p) => basename(p).replace(/\.(ts|tsx|js|jsx)$/, "") === base);
      if (match) return match;
    }
    return undefined;
  };

  return (
    fromManifest() ??
    ["src/cli.ts", "src/index.ts", "src/main.ts", "index.ts"].find((p) => set.has(p)) ??
    componentPaths[0]
  );
}

/** DFS from the entry component over internal depends_on edges, in declaration order. */
function orderedChain(entryId: string, model: ArchitectureModel): string[] {
  const adjacency = new Map<string, string[]>();
  for (const r of model.relations) {
    if (!r.to.startsWith("comp:")) continue; // internal edges only
    (adjacency.get(r.from) ?? adjacency.set(r.from, []).get(r.from)!).push(r.to);
  }
  const visited = new Set<string>();
  const order: string[] = [];
  const stack = [entryId];
  while (stack.length && order.length < MAX_PROCESS_TASKS) {
    const id = stack.shift()!; // BFS-ish: keep declaration order readable
    if (visited.has(id)) continue;
    visited.add(id);
    order.push(id);
    for (const next of adjacency.get(id) ?? []) if (!visited.has(next)) stack.push(next);
  }
  return order;
}

/**
 * Enrich the model in place with structural Capabilities, one Process and one Flow.
 * Runs after Tier 1 (it needs the import graph). Pure structural — no network.
 */
export function deriveSemantics(root: string, sourceFiles: string[], model: ArchitectureModel): void {
  // --- Capabilities: exported functions/classes ---
  for (const rel of sourceFiles) {
    let text: string;
    try {
      text = readFileSync(join(root, rel), "utf8");
    } catch {
      continue;
    }
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, scriptKindFor(rel));
    for (const sym of collectExports(sf)) {
      const cap: Capability = {
        id: `cap:${rel}#${sym.name}`,
        name: humanize(sym.name),
        description: `Exported ${sym.kind} \`${sym.name}\` in ${rel}`,
        componentIds: [`comp:${rel}`],
        provenance: [{ source: "code", ref: `${rel}:${sym.line}`, confidence: HEURISTIC_CONFIDENCE }],
        confidence: HEURISTIC_CONFIDENCE,
      };
      model.capabilities.push(cap);
    }
  }

  // --- One Process + Flow from the main entry-point dependency chain ---
  const componentPaths = model.components.map((c) => c.id.slice("comp:".length));
  const entryRel = findEntryComponent(root, componentPaths);
  if (!entryRel) return;
  const entryId = `comp:${entryRel}`;
  const chain = orderedChain(entryId, model);
  if (chain.length < 2) return; // not enough structure for a meaningful process

  const nameOf = (id: string) => componentLabel(id);
  const provOf = (id: string): Provenance => ({
    source: "code",
    ref: `${id.slice("comp:".length)}:1`,
    confidence: HEURISTIC_CONFIDENCE,
  });

  const process: Process = {
    id: `proc:${entryRel}`,
    name: `${nameOf(entryId)} flow`,
    description: `Modules orchestrated from the ${entryRel} entry point (structural; refined by Tier 2).`,
    tasks: chain.map((id) => ({ id: `task:${id}`, name: nameOf(id), provenance: [provOf(id)] })),
    provenance: [provOf(entryId)],
    confidence: HEURISTIC_CONFIDENCE,
  };
  model.processes.push(process);

  const steps: FlowStep[] = [];
  for (let i = 0; i < chain.length - 1; i++) {
    steps.push({
      participant: chain[i]!,
      action: "uses",
      to: chain[i + 1]!,
      provenance: [provOf(chain[i]!)],
    });
  }
  const flow: Flow = {
    id: `flow:${entryRel}`,
    name: `${nameOf(entryId)} sequence`,
    description: `Call/dependency sequence from ${entryRel} (structural).`,
    participants: chain,
    steps,
    provenance: [provOf(entryId)],
    confidence: HEURISTIC_CONFIDENCE,
  };
  model.flows.push(flow);
}
