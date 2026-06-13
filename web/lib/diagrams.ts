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

/** ERD projection — the data model as a Mermaid erDiagram (ported from src/project/erd.ts). */
export function erDiagram(model: Model): string | null {
  const entities = model.dataEntities ?? [];
  if (!entities.length) return null;
  const token = (s: string) => s.replace(/[^A-Za-z0-9_]/g, "_");
  const byId = new Map(entities.map((e) => [e.id, e]));
  const lines: string[] = ["erDiagram"];

  const pairs = new Map<string, { a: string; b: string; aList: boolean; bList: boolean }>();
  for (const e of entities) {
    for (const f of e.fields) {
      const target = f.relationTo ? byId.get(f.relationTo) : undefined;
      if (!target) continue;
      const sorted = [e.name, target.name].sort();
      const x = sorted[0]!;
      const y = sorted[1]!;
      const key = `${x} ${y}`;
      const p = pairs.get(key) ?? { a: x, b: y, aList: false, bList: false };
      if (e.name === x) p.aList ||= !!f.list;
      else p.bList ||= !!f.list;
      pairs.set(key, p);
    }
  }
  for (const p of pairs.values()) {
    if (p.aList && p.bList) lines.push(`  ${token(p.a)} }o--o{ ${token(p.b)} : ""`);
    else if (p.aList) lines.push(`  ${token(p.a)} ||--o{ ${token(p.b)} : ""`);
    else if (p.bList) lines.push(`  ${token(p.b)} ||--o{ ${token(p.a)} : ""`);
    else lines.push(`  ${token(p.a)} ||--|| ${token(p.b)} : ""`);
  }
  for (const e of entities) {
    lines.push(`  ${token(e.name)} {`);
    for (const f of e.fields) {
      if (f.relationTo) continue;
      const type = token(f.type) + (f.list ? "_list" : "");
      const key = f.isId ? "PK" : f.isForeignKey ? "FK" : f.isUnique ? "UK" : "";
      const note = f.optional ? ' "nullable"' : "";
      lines.push(`    ${type} ${f.name}${key ? " " + key : ""}${note}`);
    }
    lines.push("  }");
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
