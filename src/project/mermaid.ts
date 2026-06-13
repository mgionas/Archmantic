/**
 * Mermaid projections (USP 6: one model → many views).
 *   - contextDiagram:   C4-context level — the system ↔ external systems/actors.
 *   - componentDiagram: the internal module/dependency graph (Tier-1 edges).
 *   - sequenceDiagram:  a Flow rendered as a sequence.
 *
 * Pure functions over the IR — no I/O, no rendering. Callers turn the source
 * into SVG (browser/mermaid CLI) or just print it.
 */
import { type ArchitectureModel, type Flow } from "../ir/types.js";
import { componentLabel } from "../ir/naming.js";

/** Mermaid node ids must be alphanumeric-ish; map element ids → safe tokens. */
function nodeId(id: string): string {
  return "n_" + id.replace(/[^A-Za-z0-9]/g, "_");
}

/** Escape for a Mermaid quoted label. */
function label(text: string): string {
  return text.replace(/"/g, "'").replace(/\n/g, " ");
}

/**
 * C4 context level: the internal system as one box, with edges to every external
 * system any component depends on, plus actors. Aggregated, not per-file.
 */
export function contextDiagram(model: ArchitectureModel): string {
  const internal = model.systems.find((s) => s.kind === "internal");
  const lines: string[] = ["flowchart LR"];

  const sysNode = internal ? nodeId(internal.id) : "n_system";
  lines.push(`  ${sysNode}["${label(internal?.name ?? model.project)}<br/><i>internal system</i>"]`);

  // External systems referenced by any component → aggregate system→external edges.
  const externalIds = new Set(model.systems.filter((s) => s.kind === "external").map((s) => s.id));
  const seenExt = new Set<string>();
  for (const r of model.relations) {
    if (!externalIds.has(r.to)) continue;
    if (!seenExt.has(r.to)) {
      const ext = model.systems.find((s) => s.id === r.to)!;
      lines.push(`  ${nodeId(r.to)}["${label(ext.name)}<br/><i>external</i>"]`);
      seenExt.add(r.to);
    }
  }
  for (const id of seenExt) lines.push(`  ${sysNode} -->|depends on| ${nodeId(id)}`);

  for (const a of model.actors) {
    lines.push(`  ${nodeId(a.id)}(["${label(a.name)}<br/><i>${a.kind}</i>"])`);
    lines.push(`  ${nodeId(a.id)} --> ${sysNode}`);
  }
  return lines.join("\n");
}

/** Internal module graph: one node per component, depends_on edges between them. */
export function componentDiagram(model: ArchitectureModel): string {
  const lines: string[] = ["flowchart TD"];
  const internal = model.systems.find((s) => s.kind === "internal");
  lines.push(`  subgraph ${nodeId(internal?.id ?? "sys")}["${label(internal?.name ?? model.project)}"]`);
  for (const c of model.components) {
    lines.push(`    ${nodeId(c.id)}["${label(componentLabel(c.id))}"]`);
  }
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

/** Render a Flow as a Mermaid sequence diagram. */
export function sequenceDiagram(flow: Flow, model: ArchitectureModel): string {
  const lines: string[] = ["sequenceDiagram"];
  const nameFor = (id: string): string => {
    const el =
      model.components.find((c) => c.id === id) ??
      model.systems.find((s) => s.id === id) ??
      model.actors.find((a) => a.id === id);
    return el ? (el.id.startsWith("comp:") ? componentLabel(el.id) : el.name) : id;
  };
  for (const p of flow.participants) {
    lines.push(`  participant ${nodeId(p)} as ${label(nameFor(p))}`);
  }
  for (const step of flow.steps) {
    const target = step.to ?? step.participant;
    lines.push(`  ${nodeId(step.participant)}->>${nodeId(target)}: ${label(step.action)}`);
  }
  return lines.join("\n");
}
