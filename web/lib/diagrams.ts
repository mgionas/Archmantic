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

  // Cardinality: list field → that side is parent ("one"); single/FK field → that
  // side is child ("many"). Reads Prisma (inverse list) and Drizzle/SQL (FK-only).
  const pairs = new Map<string, { x: string; y: string; listX: boolean; listY: boolean; singleX: boolean; singleY: boolean }>();
  for (const e of entities) {
    for (const f of e.fields) {
      const target = f.relationTo ? byId.get(f.relationTo) : undefined;
      if (!target) continue;
      const [x, y] = [e.name, target.name].sort() as [string, string];
      const p = pairs.get(`${x} ${y}`) ?? { x, y, listX: false, listY: false, singleX: false, singleY: false };
      const eIsX = e.name === x;
      if (f.list) eIsX ? (p.listX = true) : (p.listY = true);
      else eIsX ? (p.singleX = true) : (p.singleY = true);
      pairs.set(`${x} ${y}`, p);
    }
  }
  for (const p of pairs.values()) {
    const X = token(p.x);
    const Y = token(p.y);
    if (p.listX && p.listY) lines.push(`  ${X} }o--o{ ${Y} : ""`);
    else if (p.listX) lines.push(`  ${X} ||--o{ ${Y} : ""`);
    else if (p.listY) lines.push(`  ${Y} ||--o{ ${X} : ""`);
    else if (p.singleX && p.singleY) lines.push(`  ${X} ||--|| ${Y} : ""`);
    else if (p.singleX) lines.push(`  ${Y} ||--o{ ${X} : ""`);
    else lines.push(`  ${X} ||--o{ ${Y} : ""`);
  }
  for (const e of entities) {
    lines.push(`  ${token(e.name)} {`);
    for (const f of e.fields) {
      if (f.relationTo && !f.isForeignKey) continue;
      const type = token(f.type) + (f.list ? "_list" : "");
      const key = f.isId ? "PK" : f.isForeignKey ? "FK" : f.isUnique ? "UK" : "";
      const note = f.optional ? ' "nullable"' : "";
      lines.push(`    ${type} ${f.name}${key ? " " + key : ""}${note}`);
    }
    lines.push("  }");
  }
  return lines.join("\n");
}

/** Node/edge graph for the component view (React Flow). Externals included as leaf nodes. */
export interface GraphNode {
  id: string;
  label: string;
  kind: "component" | "external";
  role: string;
}
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}
export function componentGraph(model: Model): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const compIds = new Set(model.components.map((c) => c.id));
  const externalIds = new Set(model.systems.filter((s) => s.kind === "external").map((s) => s.id));
  const nodes: GraphNode[] = model.components.map((c) => ({
    id: c.id,
    label: componentLabel(c.id),
    kind: "component",
    role: c.role ?? "module",
  }));
  const edges: GraphEdge[] = [];
  const usedExternals = new Set<string>();
  for (const r of model.relations) {
    if (compIds.has(r.from) && compIds.has(r.to)) {
      edges.push({ id: r.id, source: r.from, target: r.to });
    } else if (compIds.has(r.from) && externalIds.has(r.to)) {
      usedExternals.add(r.to);
      edges.push({ id: r.id, source: r.from, target: r.to });
    }
  }
  for (const id of usedExternals) {
    const ext = model.systems.find((s) => s.id === id);
    if (ext) nodes.push({ id, label: ext.name, kind: "external", role: "external" });
  }
  return { nodes, edges };
}

/** Per-component detail for the click-through panel (cross-facet navigation). */
export interface CompDetail {
  id: string;
  label: string;
  path: string;
  role: string;
  responsibility?: string;
  ref: string;
  dependsOn: { id: string; label: string }[];
  usedBy: { id: string; label: string }[];
  capabilities: string[];
  endpoints: { method: string; path: string }[];
  entities: string[];
}

const fileOf = (prov?: { ref: string }[]) => prov?.[0]?.ref?.split(":")[0];

export function componentDetails(model: Model): Record<string, CompDetail> {
  const compIds = new Set(model.components.map((c) => c.id));
  const lbl = (id: string) => componentLabel(id);
  const out: Record<string, CompDetail> = {};
  for (const c of model.components) {
    const path = c.id.replace(/^comp:/, "");
    out[c.id] = {
      id: c.id,
      label: lbl(c.id),
      path,
      role: c.role ?? "module",
      responsibility: c.responsibility,
      ref: c.provenance?.[0]?.ref ?? path,
      dependsOn: model.relations.filter((r) => r.from === c.id && compIds.has(r.to)).map((r) => ({ id: r.to, label: lbl(r.to) })),
      usedBy: model.relations.filter((r) => r.to === c.id && compIds.has(r.from)).map((r) => ({ id: r.from, label: lbl(r.from) })),
      capabilities: model.capabilities.filter((cap) => cap.componentIds?.includes(c.id)).map((cap) => cap.name),
      endpoints: (model.endpoints ?? []).filter((e) => fileOf(e.provenance) === path).map((e) => ({ method: e.method, path: e.path })),
      entities: (model.dataEntities ?? []).filter((en) => fileOf(en.provenance) === path).map((en) => en.name),
    };
  }
  return out;
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
