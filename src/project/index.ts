/**
 * Projection layer — turns the one grounded IR into the many views (Mermaid
 * context/component/sequence, BPMN process, the capability map, the trust
 * surface) and a self-contained HTML viewer. See docs/ARCHITECTURE.md §1.
 */
import { type ArchitectureModel } from "../ir/types.js";
import { contextDiagram, componentDiagram, sequenceDiagram } from "./mermaid.js";
import { bpmnXml } from "./bpmn.js";
import { capabilityMapText } from "./capability.js";
import { renderHtml } from "./html.js";
import { summarize, type Grounded } from "./trust.js";

export { contextDiagram, componentDiagram, sequenceDiagram } from "./mermaid.js";
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
  ];
  const s = summarize(grounded);
  const out: string[] = [];

  out.push(`${BOLD}${model.project}${RESET} — living architecture model`);
  out.push(
    `${DIM}trust:${RESET} ${s.total} elements · ${s.totalRefs} code refs · ` +
      `${Math.round(s.meanConfidence * 100)}% mean confidence ` +
      `(${s.high} high / ${s.medium} medium / ${s.low} low ⚠)`,
  );

  out.push(`\n${BOLD}Capability map${RESET} ${DIM}— what can this system do?${RESET}`);
  out.push(capabilityMapText(model));

  out.push(`\n${BOLD}Context diagram${RESET} ${DIM}(Mermaid source)${RESET}`);
  out.push(contextDiagram(model));

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
  return artifacts;
}
