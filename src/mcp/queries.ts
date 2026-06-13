/**
 * Read queries over the IR — the data plane behind both the MCP server and the
 * token-savings benchmark. Pure functions: model in, compact grounded text out.
 *
 * The whole MCP value prop is that an agent gets exactly the architectural slice
 * it needs (a few hundred tokens) instead of reading whole source files. Keep
 * every answer tight and always carry the `file:line` grounding so the agent can
 * cite/verify.
 */
import { type ArchitectureModel, type Component } from "../ir/types.js";
import { componentLabel } from "../ir/naming.js";

const rel = (id: string) => id.slice(id.indexOf(":") + 1);

/** Short display name: folder-aware component label, or external system name. */
const shortName = (id: string): string =>
  id.startsWith("comp:")
    ? componentLabel(id)
    : id.startsWith("sys:ext:")
      ? id.slice("sys:ext:".length)
      : id;

function refOf(el: { provenance: { ref: string }[] }): string {
  return el.provenance[0]?.ref ?? "?";
}

/** Resolve a loose name (id, path, basename, suffix) to a component. */
export function findComponent(model: ArchitectureModel, name: string): Component | undefined {
  const n = name.trim();
  const r = n.startsWith("comp:") ? n.slice("comp:".length) : n;
  return (
    model.components.find((c) => c.id === n) ??
    model.components.find((c) => rel(c.id) === r) ??
    model.components.find((c) => rel(c.id).endsWith("/" + r)) ??
    model.components.find((c) => componentLabel(c.id).toLowerCase() === r.toLowerCase()) ??
    model.components.find((c) => rel(c.id).split("/").pop() === r)
  );
}

export function getContext(model: ArchitectureModel): string {
  const internal = model.systems.find((s) => s.kind === "internal");
  const externals = model.systems.filter((s) => s.kind === "external");
  const internalDeps = model.relations.filter((r) => r.to.startsWith("comp:")).length;
  const lines = [
    `Project: ${model.project}`,
    internal ? `System: ${internal.name} — ${internal.description ?? "internal system"}` : "",
    `Components: ${model.components.length}  ·  internal dependencies: ${internalDeps}`,
    `External systems (${externals.length}): ${externals.map((s) => s.name).join(", ") || "none"}`,
    `Capabilities: ${model.capabilities.length}  ·  processes: ${model.processes.length}  ·  flows: ${model.flows.length}`,
  ];
  if (model.processes[0]) lines.push(`Primary process: ${model.processes[0].name}`);
  return lines.filter(Boolean).join("\n");
}

export function listComponents(model: ArchitectureModel, filter?: string): string {
  const f = filter?.trim().toLowerCase();
  const rows = model.components
    .filter((c) => !f || rel(c.id).toLowerCase().includes(f) || c.name.toLowerCase().includes(f))
    .map((c) => `- ${componentLabel(c.id)} (${rel(c.id)})${c.responsibility ? ` — ${c.responsibility}` : ""}`);
  return rows.length ? rows.join("\n") : "(no matching components)";
}

export function getComponent(model: ArchitectureModel, name: string): string {
  const c = findComponent(model, name);
  if (!c) return `No component matches "${name}". Try \`list_components\`.`;
  const out = model.relations.filter((r) => r.from === c.id).map((r) => `${shortName(r.to)} (${refOf(r)})`);
  const inc = model.relations.filter((r) => r.to === c.id).map((r) => componentLabel(r.from));
  const caps = model.capabilities.filter((cap) => cap.componentIds.includes(c.id)).map((cap) => cap.name);
  return [
    `${componentLabel(c.id)}  [${rel(c.id)}]`,
    c.responsibility ? `Responsibility: ${c.responsibility}` : "",
    `Confidence: ${c.confidence} · grounded: ${refOf(c)}`,
    `Depends on (${out.length}): ${out.join(", ") || "—"}`,
    `Used by (${inc.length}): ${inc.join(", ") || "—"}`,
    caps.length ? `Capabilities: ${caps.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function searchCapabilities(model: ArchitectureModel, query: string): string {
  const q = query.trim().toLowerCase();
  const hits = model.capabilities.filter(
    (cap) => !q || cap.name.toLowerCase().includes(q) || (cap.description ?? "").toLowerCase().includes(q),
  );
  if (!hits.length) return `No capabilities match "${query}".`;
  return hits
    .map((cap) => `- ${cap.name}: ${cap.description ?? "(no description)"}  [${refOf(cap)}]`)
    .join("\n");
}

export function getProcess(model: ArchitectureModel): string {
  const p = model.processes[0];
  if (!p) return "No process derived.";
  const steps = p.tasks.map((t, i) => `${i + 1}. ${t.name}`).join("\n");
  return [`Process: ${p.name}`, p.description ?? "", `Steps:`, steps, `(grounded: ${refOf(p)}, confidence ${p.confidence})`]
    .filter(Boolean)
    .join("\n");
}

export function getSequence(model: ArchitectureModel): string {
  const f = model.flows[0];
  if (!f) return "No flow derived.";
  const nameFor = (id: string) => (id.startsWith("comp:") ? componentLabel(id) : id);
  const steps = f.steps.map((s) => `${nameFor(s.participant)} ${s.action} ${nameFor(s.to ?? s.participant)}`);
  return [`Sequence: ${f.name}`, ...steps].join("\n");
}

export function getDataModel(model: ArchitectureModel): string {
  const entities = model.dataEntities ?? [];
  if (!entities.length) return "No data model detected (no Prisma schema found).";
  const out: string[] = [`Data model: ${entities.length} entities`];
  for (const e of entities) {
    const cols = e.fields
      .filter((f) => !f.relationTo)
      .map((f) => {
        const tags = [f.isId ? "PK" : "", f.isForeignKey ? "FK" : "", f.isUnique && !f.isId ? "unique" : ""]
          .filter(Boolean)
          .join(" ");
        return `${f.name}: ${f.type}${f.list ? "[]" : ""}${f.optional ? "?" : ""}${tags ? ` (${tags})` : ""}`;
      });
    const rels = e.fields
      .filter((f) => f.relationTo)
      .map((f) => `${f.name} → ${f.type}${f.list ? "[]" : ""}`);
    out.push(`\n${e.name}  [${refOf(e)}]`);
    out.push(`  fields: ${cols.join(", ") || "—"}`);
    if (rels.length) out.push(`  relations: ${rels.join(", ")}`);
  }
  return out.join("\n");
}

export function whatsRelated(model: ArchitectureModel, name: string): string {
  const c = findComponent(model, name);
  if (!c) return `No component matches "${name}".`;
  const out = model.relations.filter((r) => r.from === c.id).map((r) => `→ ${shortName(r.to)}`);
  const inc = model.relations.filter((r) => r.to === c.id).map((r) => `← ${componentLabel(r.from)}`);
  return [`Related to ${componentLabel(c.id)}:`, ...out, ...inc].join("\n") || "(no relations)";
}
