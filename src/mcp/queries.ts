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
import { analyzeLinks } from "../system.js";

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
  if (model.manifest?.goal) lines.splice(1, 0, `Goal: ${model.manifest.goal}`);
  if (model.processes[0]) lines.push(`Primary process: ${model.processes[0].name}`);
  const ws = model.workspaces ?? [];
  if (ws.length) lines.push(`Monorepo (${ws.length} packages): ${ws.join(", ")}`);
  return lines.filter(Boolean).join("\n");
}

/** The project brain: goal, status, ownership, the agent team, links, history. */
export function getProject(model: ArchitectureModel): string {
  const m = model.manifest;
  const out = [`Project: ${model.project}`];
  if (!m || !Object.keys(m).length) {
    out.push("No project manifest yet. Create .archmantic/project.json (run `archmantic project --init`)");
    out.push("to declare the goal, owner, and agent team so agents get the intent, not just the structure.");
    return out.join("\n");
  }
  if (m.goal) out.push(`Goal: ${m.goal}`);
  if (m.status) out.push(`Status: ${m.status}`);
  if (m.author?.name) out.push(`Author: ${m.author.name}${m.author.email ? ` <${m.author.email}>` : ""}${m.author.url ? ` (${m.author.url})` : ""}`);
  if (m.owners?.length) out.push(`Owners: ${m.owners.join(", ")}`);
  if (m.agents?.length) {
    out.push(`\nAgents (${m.agents.length}):`);
    for (const a of m.agents) out.push(`  - ${a.name}${a.role ? ` — ${a.role}` : ""}${a.file ? ` [${a.file}]` : ""}`);
  }
  if (m.links?.length) {
    out.push(`\nLinks:`);
    for (const l of m.links) out.push(`  - ${l.label}: ${l.url}`);
  }
  if (m.history?.length) {
    out.push(`\nHistory:`);
    for (const h of m.history) out.push(`  - ${h.date ? `${h.date}: ` : ""}${h.note}`);
  }
  return out.join("\n");
}

export function listComponents(model: ArchitectureModel, filter?: string): string {
  const f = filter?.trim().toLowerCase();
  const rows = model.components
    .filter((c) => !f || rel(c.id).toLowerCase().includes(f) || c.name.toLowerCase().includes(f))
    .map(
      (c) =>
        `- ${componentLabel(c.id)} (${rel(c.id)})${c.role && c.role !== "module" ? ` [${c.role}]` : ""}` +
        `${c.responsibility ? ` — ${c.responsibility}` : ""}`,
    );
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
      .filter((f) => !(f.relationTo && !f.isForeignKey))
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

export function getApiSurface(model: ArchitectureModel): string {
  const eps = model.endpoints ?? [];
  if (!eps.length) return "No API endpoints detected (no routes/procedures/GraphQL schema found).";
  const line = (e: (typeof eps)[number]) => `  ${e.method} ${e.path}  [${refOf(e)}]`;

  // Monorepo: group by owning package first — the agent needs to know which app
  // serves a route before it cares about the protocol.
  if ((model.workspaces ?? []).length) {
    const byPkg = new Map<string, typeof eps>();
    for (const e of eps) {
      const k = e.package ?? "(root)";
      (byPkg.get(k) ?? byPkg.set(k, []).get(k)!).push(e);
    }
    const out: string[] = [`API surface: ${eps.length} endpoints across ${byPkg.size} packages`];
    for (const [pkg, list] of [...byPkg.entries()].sort()) {
      out.push(`\n${pkg} (${list.length})`);
      for (const e of list) out.push(line(e));
    }
    return out.join("\n");
  }

  const byProto = new Map<string, typeof eps>();
  for (const e of eps) (byProto.get(e.protocol) ?? byProto.set(e.protocol, []).get(e.protocol)!).push(e);
  const out: string[] = [`API surface: ${eps.length} endpoints`];
  for (const [proto, list] of [...byProto.entries()].sort()) {
    out.push(`\n${proto.toUpperCase()} (${list.length})`);
    for (const e of list) out.push(line(e));
  }
  return out.join("\n");
}

/**
 * Cross-repo link suggestions for the current repo: merge its model with the org's
 * other models and classify links (connected/inferred/dangling). Returns the
 * actionable suggestions for THIS project to declare/fix in .archmantic/config.json.
 */
export function getLinkSuggestions(local: ArchitectureModel, org: ArchitectureModel[]): string {
  const byProject = new Map<string, ArchitectureModel>();
  for (const m of org) byProject.set(m.project, m);
  byProject.set(local.project, local); // ensure the current (freshest) model wins
  const models = [...byProject.values()];
  if (models.length < 2) {
    return (
      "Only this repo's model is available, so there's nothing to compare against. " +
      "Set ARCHMANTIC_TOKEN (org) or DATABASE_URL so suggest_links can see your other repos, " +
      "and make sure they've been pushed (`archmantic push`)."
    );
  }
  const mine = analyzeLinks(models).links.filter((l) => l.from === local.project);
  const inferred = mine.filter((l) => l.status === "inferred");
  const dangling = mine.filter((l) => l.status === "dangling");
  const connected = mine.filter((l) => l.status === "connected");

  const out = [
    `Cross-repo links for "${local.project}" (across ${models.length} repos): ` +
      `${connected.length} connected · ${inferred.length} inferred · ${dangling.length} dangling`,
  ];
  if (inferred.length) {
    out.push(`\nInferred — add to .archmantic/config.json "consumes" to confirm:`);
    for (const l of inferred) out.push(`  + ${l.to}   (${l.reason})`);
  }
  if (dangling.length) {
    out.push(`\nDangling — declared but no matching repo (fix the name or remove):`);
    for (const l of dangling) out.push(`  ! ${l.to}   (${l.reason})`);
  }
  if (!inferred.length && !dangling.length) out.push(`\nNo changes suggested — declared links all resolve. ✅`);
  return out.join("\n");
}

export function whatsRelated(model: ArchitectureModel, name: string): string {
  const c = findComponent(model, name);
  if (!c) return `No component matches "${name}".`;
  const out = model.relations.filter((r) => r.from === c.id).map((r) => `→ ${shortName(r.to)}`);
  const inc = model.relations.filter((r) => r.to === c.id).map((r) => `← ${componentLabel(r.from)}`);
  return [`Related to ${componentLabel(c.id)}:`, ...out, ...inc].join("\n") || "(no relations)";
}
