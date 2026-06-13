/**
 * Projection layer — turns the one grounded IR into the many views (Mermaid
 * context/component/sequence, BPMN process, the capability map, the trust
 * surface) and a self-contained HTML viewer. See docs/ARCHITECTURE.md §1.
 */
import { type ArchitectureModel } from "../ir/types.js";
import { contextDiagram, componentDiagram, sequenceDiagram } from "./mermaid.js";
import { erDiagram } from "./erd.js";
import { bpmnXml } from "./bpmn.js";
import { capabilityMapText } from "./capability.js";
import { renderHtml } from "./html.js";
import { summarize, type Grounded } from "./trust.js";

export { contextDiagram, componentDiagram, sequenceDiagram } from "./mermaid.js";
export { erDiagram } from "./erd.js";
export { bpmnXml } from "./bpmn.js";
export { capabilityMapText, groupCapabilities } from "./capability.js";
export { renderHtml } from "./html.js";
export { buildSpecMarkdown, buildSpecJson, type BuildSpecJson } from "./spec.js";
export { parseBpmnProcess, type ParsedProcess } from "./bpmn-parse.js";
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
    for (const t of model.technologies) (byCat.get(t.category) ?? byCat.set(t.category, []).get(t.category)!).push(t.name);
    const stack = [...byCat.entries()].sort().map(([c, n]) => `${c}: ${n.join(", ")}`).join(" · ");
    out.push(`\n${BOLD}Stack${RESET} ${DIM}${stack}${RESET}`);
  }

  out.push(`\n${BOLD}Capability map${RESET} ${DIM}— what can this system do?${RESET}`);
  out.push(capabilityMapText(model));

  out.push(`\n${BOLD}Context diagram${RESET} ${DIM}(Mermaid source)${RESET}`);
  out.push(contextDiagram(model));

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
    out.push(`\n${BOLD}Process${RESET} ${DIM}(BPMN)${RESET} — ${proc.name}`);
    out.push("  " + proc.tasks.map((t) => t.name).join("  →  "));
  }

  return out.join("\n");
}

/** Everything the `view` command emits to disk, keyed by relative filename. */
export function projectionArtifacts(model: ArchitectureModel): Record<string, string> {
  const artifacts: Record<string, string> = {
    "view.html": renderHtml(model),
    "context.mmd": contextDiagram(model),
    "components.mmd": componentDiagram(model),
  };
  if (model.flows[0]) artifacts["sequence.mmd"] = sequenceDiagram(model.flows[0], model);
  if (model.processes[0]) artifacts["process.bpmn"] = bpmnXml(model.processes[0]);
  if (model.dataEntities?.length) artifacts["data.mmd"] = erDiagram(model);
  return artifacts;
}
