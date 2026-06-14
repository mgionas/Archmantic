import type { Model } from "./store";
import { groupCapabilities } from "./format";

/** Agent-knowledge projection (mirrors src/project/knowledge.ts) — a concise,
 *  grounded summary of the model, the same text written to AGENTS.md. */
export function knowledgeMarkdown(model: Model): string {
  const internal = model.systems.find((s) => s.kind === "internal");
  const externals = model.systems.filter((s) => s.kind === "external").map((s) => s.name);
  const refOf = (el: { provenance?: { ref: string }[] }) => el.provenance?.[0]?.ref ?? "?";
  const out: string[] = [];

  out.push("## Architecture (Archmantic)");
  out.push("");
  out.push("> Auto-generated from the grounded architecture model. Refresh with `archmantic knowledge`.");
  out.push("");
  out.push(`**${model.project}**${internal?.description ? ` — ${internal.description}` : ""}`);
  out.push("");

  const man = model.manifest;
  if (man?.goal) {
    out.push(`**Goal:** ${man.goal}`);
    out.push("");
  }
  const meta: string[] = [];
  if (man?.status) meta.push(`status: ${man.status}`);
  if (man?.author?.name) meta.push(`author: ${man.author.name}${man.author.url ? ` (${man.author.url})` : ""}`);
  if (man?.owners?.length) meta.push(`owners: ${man.owners.join(", ")}`);
  if (meta.length) {
    out.push(meta.join(" · "));
    out.push("");
  }
  if (man?.agents?.length) {
    out.push(`**Agents:** ${man.agents.map((a) => (a.role ? `${a.name} (${a.role})` : a.name)).join(" · ")}`);
    out.push("");
  }
  if (man?.links?.length) {
    out.push("**Links:** " + man.links.map((l) => `[${l.label}](${l.url})`).join(" · "));
    out.push("");
  }

  out.push(
    `${model.components.length} components · ${model.capabilities.length} capabilities · ` +
      `${model.endpoints?.length ?? 0} endpoints · ${model.dataEntities?.length ?? 0} data entities.`,
  );

  if (model.workspaces?.length) {
    out.push("");
    out.push(`**Monorepo** — ${model.workspaces.length} workspace packages: ${model.workspaces.join(", ")}`);
  }

  const roleCounts = new Map<string, number>();
  for (const c of model.components) roleCounts.set(c.role ?? "module", (roleCounts.get(c.role ?? "module") ?? 0) + 1);
  const roles = [...roleCounts.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${n} ${r}`);
  if (roles.length) {
    out.push("");
    out.push(`**Component roles:** ${roles.join(" · ")}`);
  }

  const groups = groupCapabilities(model);
  if (groups.length) {
    out.push("");
    out.push("### What it does (capabilities)");
    let shown = 0;
    const CAP = 40;
    for (const g of groups) {
      if (shown >= CAP) break;
      const names = g.caps.slice(0, CAP - shown).map((c) => c.name);
      shown += names.length;
      out.push(`- **${g.area}/** — ${names.join(", ")}`);
    }
    if (model.capabilities.length > shown) out.push(`- …and ${model.capabilities.length - shown} more`);
  }

  if (model.dataEntities?.length) {
    out.push("");
    out.push("### Data model");
    for (const e of model.dataEntities.slice(0, 30)) {
      const cols = e.fields.filter((f) => !(f.relationTo && !f.isForeignKey)).map((f) => f.name);
      const rels = e.fields.filter((f) => f.relationTo).map((f) => `→${f.type}`);
      out.push(`- **${e.name}** <sub>${refOf(e)}</sub>: ${cols.join(", ")}${rels.length ? `  ${rels.join(" ")}` : ""}`);
    }
    if (model.dataEntities.length > 30) out.push(`- …and ${model.dataEntities.length - 30} more`);
  }

  if (model.endpoints?.length) {
    out.push("");
    out.push("### API surface");
    for (const ep of model.endpoints.slice(0, 50)) out.push(`- \`${ep.method} ${ep.path}\` (${ep.protocol})`);
    if (model.endpoints.length > 50) out.push(`- …and ${model.endpoints.length - 50} more`);
  }

  const proc = model.processes?.[0];
  if (proc) {
    out.push("");
    out.push(`### Primary process: ${proc.name}`);
    out.push(proc.tasks.map((t) => t.name).join(" → "));
  }

  if (externals.length) {
    out.push("");
    out.push(`**External systems:** ${externals.join(", ")}`);
  }
  if (model.technologies?.length) {
    const byCat = new Map<string, string[]>();
    for (const t of model.technologies)
      if (t.category !== "library") (byCat.get(t.category) ?? byCat.set(t.category, []).get(t.category)!).push(t.name);
    if (byCat.size) {
      out.push("");
      out.push("**Stack:** " + [...byCat.entries()].sort().map(([c, n]) => `${c}: ${n.join("/")}`).join(" · "));
    }
    const libs = model.technologies.filter((t) => t.category === "library").length;
    if (libs) out.push(`_+ ${libs} other libraries._`);
  }

  return out.join("\n");
}
