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

// ── Context graph (system ↔ externals) for React Flow ─────────────────────────

export interface ContextNode {
  id: string;
  label: string;
  kind: "system" | "external";
}
export interface ContextEdge {
  id: string;
  source: string;
  target: string;
}
export function contextGraph(model: Model): { nodes: ContextNode[]; edges: ContextEdge[] } {
  const internal = model.systems.find((s) => s.kind === "internal");
  const sysId = internal?.id ?? "sys:internal";
  const nodes: ContextNode[] = [{ id: sysId, label: internal?.name ?? model.project, kind: "system" }];
  const externalIds = new Set(model.systems.filter((s) => s.kind === "external").map((s) => s.id));
  const edges: ContextEdge[] = [];
  const seen = new Set<string>();
  for (const r of model.relations) {
    if (!externalIds.has(r.to) || seen.has(r.to)) continue;
    seen.add(r.to);
    const ext = model.systems.find((s) => s.id === r.to)!;
    nodes.push({ id: r.to, label: ext.name, kind: "external" });
    edges.push({ id: `e:${r.to}`, source: sysId, target: r.to });
  }
  return { nodes, edges };
}

export interface ContextDetail {
  label: string;
  kind: string;
  usedBy: string[];
}
export function contextDetails(model: Model): Record<string, ContextDetail> {
  const compIds = new Set(model.components.map((c) => c.id));
  const out: Record<string, ContextDetail> = {};
  for (const s of model.systems) {
    if (s.kind === "external") {
      const usedBy = model.relations.filter((r) => r.to === s.id && compIds.has(r.from)).map((r) => componentLabel(r.from));
      out[s.id] = { label: s.name, kind: "external", usedBy: [...new Set(usedBy)] };
    } else if (s.kind === "internal") {
      out[s.id] = { label: s.name, kind: "internal", usedBy: [] };
    }
  }
  return out;
}

// ── Entity graph (ERD) for React Flow ─────────────────────────────────────────

export interface EntityField {
  name: string;
  type: string;
  key?: "PK" | "FK" | "UK";
  optional?: boolean;
}
export interface EntityNode {
  id: string;
  label: string;
  ref: string;
  fields: EntityField[];
}
export interface EntityEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}
export function entityGraph(model: Model): { nodes: EntityNode[]; edges: EntityEdge[] } {
  const ents = model.dataEntities ?? [];
  const byId = new Map(ents.map((e) => [e.id, e]));
  const nodes: EntityNode[] = ents.map((e) => ({
    id: e.id,
    label: e.name,
    ref: e.provenance?.[0]?.ref ?? "",
    fields: e.fields
      .filter((f) => !(f.relationTo && !f.isForeignKey))
      .map((f) => ({
        name: f.name,
        type: f.type + (f.list ? "[]" : ""),
        key: f.isId ? "PK" : f.isForeignKey ? "FK" : f.isUnique ? "UK" : undefined,
        optional: f.optional,
      })),
  }));

  const pairs = new Map<string, { x: string; y: string; listX: boolean; listY: boolean; singleX: boolean; singleY: boolean }>();
  for (const e of ents) {
    for (const f of e.fields) {
      const t = f.relationTo ? byId.get(f.relationTo) : undefined;
      if (!t) continue;
      const [x, y] = [e.id, t.id].sort() as [string, string];
      const p = pairs.get(`${x} ${y}`) ?? { x, y, listX: false, listY: false, singleX: false, singleY: false };
      const eIsX = e.id === x;
      if (f.list) eIsX ? (p.listX = true) : (p.listY = true);
      else eIsX ? (p.singleX = true) : (p.singleY = true);
      pairs.set(`${x} ${y}`, p);
    }
  }
  const edges: EntityEdge[] = [];
  for (const p of pairs.values()) {
    let source = p.x;
    let target = p.y;
    let label = "1–1";
    if (p.listX && p.listY) label = "n–n";
    else if (p.listX) label = "1–n";
    else if (p.listY) {
      source = p.y;
      target = p.x;
      label = "1–n";
    } else if (p.singleX && p.singleY) label = "1–1";
    else if (p.singleX) {
      source = p.y;
      target = p.x;
      label = "1–n";
    } else label = "1–n";
    edges.push({ id: `${p.x}|${p.y}`, source, target, label });
  }
  return { nodes, edges };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}
const seqNameFor = (id: string) =>
  id.startsWith("comp:") ? componentLabel(id) : id.replace(/^sys:ext:/, "");

/** A flow as an interactive graph (xyflow): participants → role-colored nodes,
 *  ordered steps → labeled edges ("1. renders", "2. calls"). Replaces Mermaid. */
export function flowGraph(model: Model, flow: Model["flows"][number]): { nodes: GraphNode[]; edges: FlowEdge[] } {
  const roleById = new Map(model.components.map((c) => [c.id, c.role ?? "module"]));
  const nodes: GraphNode[] = flow.participants.map((id) => ({
    id,
    label: seqNameFor(id),
    kind: id.startsWith("comp:") ? "component" : "external",
    role: id.startsWith("comp:") ? roleById.get(id) ?? "module" : "external",
  }));
  const seen = new Set<string>();
  const edges: FlowEdge[] = [];
  flow.steps.forEach((s, i) => {
    const target = s.to ?? s.participant;
    const key = `${s.participant}->${target}`;
    if (seen.has(key)) return; // collapse repeated edges; first occurrence keeps the order label
    seen.add(key);
    edges.push({ id: `e${i}`, source: s.participant, target, label: `${i + 1}. ${s.action}` });
  });
  return { nodes, edges };
}

/** One graph per flow — a deck the UI pages through (feature flows, richest first). */
export function sequenceDeck(model: Model): { id: string; name: string; graph: { nodes: GraphNode[]; edges: FlowEdge[] } }[] {
  return (model.flows ?? [])
    .filter((f) => f.steps.length)
    .map((f) => ({ id: f.id, name: f.name.replace(/ flow$/, ""), graph: flowGraph(model, f) }));
}
