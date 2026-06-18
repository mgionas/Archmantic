/**
 * Projection layer — turns the one grounded IR into the many views (context,
 * components, sequence, the process flow, the capability map, the trust surface)
 * and a self-contained HTML viewer. The web app renders graphs interactively
 * with React Flow; the CLI emits this HTML. See docs/ARCHITECTURE.md §1.
 */
import { type ArchitectureModel } from "../ir/types.js";
import { isRealExternalSystem } from "../analyze/stack.js";
import { capabilityMapText } from "./capability.js";
import { renderHtml } from "./html.js";
import { summarize, type Grounded } from "./trust.js";

export { capabilityMapText, groupCapabilities } from "./capability.js";
export { renderHtml } from "./html.js";
export { buildSpecMarkdown, buildSpecJson, type BuildSpecJson } from "./spec.js";
export { knowledgeMarkdown, applyKnowledgeBlock, KNOWLEDGE_START, KNOWLEDGE_END } from "./knowledge.js";
export {
  readManifest,
  applyManifest,
  detectAgents,
  scaffoldManifest,
  starterManifest,
  MANIFEST_PATH,
} from "./manifest.js";
export {
  readFeatures,
  seedFeatures,
  detectFeatures,
  mergeFeatures,
  parseFeatureFile,
  seedFeatureFiles,
  featureFileMarkdown,
  slugify,
  FEATURES_DIR,
} from "./features.js";
export * from "./trust.js";

const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

/** A compact, copy-pasteable preview for the terminal (the `view` default). */
export function terminalPreview(model: ArchitectureModel): string {
  const grounded: Grounded[] = [
    ...model.systems,
    ...model.components,
    ...model.relations,
    ...model.capabilities,
    ...model.flows,
    ...model.processes,
    ...(model.dataEntities ?? []),
    ...(model.endpoints ?? []),
  ];
  const s = summarize(grounded);
  const out: string[] = [];

  out.push(`${BOLD}${model.project}${RESET} — living architecture model`);
  out.push(
    `${DIM}trust:${RESET} ${s.total} elements · ${s.totalRefs} code refs · ` +
      `${Math.round(s.meanConfidence * 100)}% mean confidence ` +
      `(${s.high} high / ${s.medium} medium / ${s.low} low ⚠)`,
  );

  if (model.technologies?.length) {
    const byCat = new Map<string, string[]>();
    for (const t of model.technologies)
      if (t.category !== "library") (byCat.get(t.category) ?? byCat.set(t.category, []).get(t.category)!).push(t.name);
    const stack = [...byCat.entries()].sort().map(([c, n]) => `${c}: ${n.join(", ")}`).join(" · ");
    const libs = model.technologies.filter((t) => t.category === "library").length;
    if (stack) out.push(`\n${BOLD}Stack${RESET} ${DIM}${stack}${libs ? ` · +${libs} libraries` : ""}${RESET}`);
  }

  out.push(`\n${BOLD}Capability map${RESET} ${DIM}— what can this system do?${RESET}`);
  out.push(capabilityMapText(model));

  const externals = model.systems.filter((s) => s.kind === "external" && isRealExternalSystem(s));
  if (externals.length) {
    const internal = model.systems.find((s) => s.kind === "internal");
    out.push(`\n${BOLD}Context${RESET} ${DIM}— ${internal?.name ?? model.project} depends on${RESET}`);
    out.push("  " + externals.map((e) => e.name).join("  ·  "));
  }

  if (model.dataEntities?.length) {
    out.push(`\n${BOLD}Data model${RESET} ${DIM}— ${model.dataEntities.length} entities${RESET}`);
    out.push(
      "  " +
        model.dataEntities
          .map((e) => `${e.name} (${e.fields.filter((f) => !f.relationTo).length})`)
          .join("  ·  "),
    );
  }

  if (model.endpoints?.length) {
    out.push(`\n${BOLD}API surface${RESET} ${DIM}— ${model.endpoints.length} endpoints${RESET}`);
    for (const e of model.endpoints.slice(0, 12)) out.push(`  ${e.method.padEnd(7)} ${e.path} ${DIM}(${e.protocol})${RESET}`);
    if (model.endpoints.length > 12) out.push(`  ${DIM}… and ${model.endpoints.length - 12} more${RESET}`);
  }

  const proc = model.processes[0];
  if (proc) {
    out.push(`\n${BOLD}Process${RESET} ${DIM}— ${proc.name}${RESET}`);
    out.push("  " + proc.tasks.map((t) => t.name).join("  →  "));
  }

  return out.join("\n");
}

/** Everything the `view` command emits to disk, keyed by relative filename.
 *  Interactive graphs live in the web app (React Flow); the CLI ships the
 *  self-contained HTML viewer. */
export function projectionArtifacts(model: ArchitectureModel): Record<string, string> {
  return {
    "view.html": renderHtml(model),
  };
}
