import type { Model } from "./store";
import { componentLabel } from "./format";

/** Mermaid projections, ported from the CLI projection layer (one model → many views). */

function nodeId(id: string): string {
  return "n_" + id.replace(/[^A-Za-z0-9]/g, "_");
}
function label(text: string): string {
  return text.replace(/"/g, "'").replace(/\n/g, " ");
}

export function contextDiagram(model: Model): string {
  const internal = model.systems.find((s) => s.kind === "internal");
  const lines: string[] = ["flowchart LR"];
  const sysNode = internal ? nodeId(internal.id) : "n_system";
  lines.push(`  ${sysNode}["${label(internal?.name ?? model.project)}<br/><i>internal system</i>"]`);

  const externalIds = new Set(model.systems.filter((s) => s.kind === "external").map((s) => s.id));
  const seen = new Set<string>();
  for (const r of model.relations) {
    if (!externalIds.has(r.to) || seen.has(r.to)) continue;
    const ext = model.systems.find((s) => s.id === r.to)!;
    lines.push(`  ${nodeId(r.to)}["${label(ext.name)}<br/><i>external</i>"]`);
    seen.add(r.to);
  }
  for (const id of seen) lines.push(`  ${sysNode} -->|depends on| ${nodeId(id)}`);
  return lines.join("\n");
}

export function componentDiagram(model: Model): string {
  const internal = model.systems.find((s) => s.kind === "internal");
  const lines: string[] = ["flowchart TD"];
  lines.push(`  subgraph ${nodeId(internal?.id ?? "sys")}["${label(internal?.name ?? model.project)}"]`);
  for (const c of model.components) lines.push(`    ${nodeId(c.id)}["${label(componentLabel(c.id))}"]`);
  lines.push("  end");

  const compIds = new Set(model.components.map((c) => c.id));
  const externalIds = new Set(model.systems.filter((s) => s.kind === "external").map((s) => s.id));
  const drawnExt = new Set<string>();
  for (const r of model.relations) {
    if (compIds.has(r.from) && compIds.has(r.to)) {
      lines.push(`  ${nodeId(r.from)} --> ${nodeId(r.to)}`);
    } else if (compIds.has(r.from) && externalIds.has(r.to)) {
      if (!drawnExt.has(r.to)) {
        const ext = model.systems.find((s) => s.id === r.to)!;
        lines.push(`  ${nodeId(r.to)}[/"${label(ext.name)}"/]`);
        drawnExt.add(r.to);
      }
      lines.push(`  ${nodeId(r.from)} -.-> ${nodeId(r.to)}`);
    }
  }
  return lines.join("\n");
}

export function sequenceDiagram(model: Model): string | null {
  const flow = model.flows[0];
  if (!flow) return null;
  const lines: string[] = ["sequenceDiagram"];
  const nameFor = (id: string) => (id.startsWith("comp:") ? componentLabel(id) : id);
  for (const p of flow.participants) lines.push(`  participant ${nodeId(p)} as ${label(nameFor(p))}`);
  for (const step of flow.steps) {
    const target = step.to ?? step.participant;
    lines.push(`  ${nodeId(step.participant)}->>${nodeId(target)}: ${label(step.action)}`);
  }
  return lines.join("\n");
}
