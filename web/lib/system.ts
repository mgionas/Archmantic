import type { Model } from "./store";

/** Multi-repo system aggregation (ported from the CLI's src/system.ts). */

export interface ServiceSummary {
  project: string;
  system?: string;
  consumes: string[];
  components: number;
  capabilities: number;
  externals: string[];
  technologies: string[];
}

export function summarizeService(m: Model): ServiceSummary {
  return {
    project: m.project,
    system: m.system,
    consumes: m.consumes ?? [],
    components: m.components.length,
    capabilities: m.capabilities.length,
    externals: m.systems.filter((s) => s.kind === "external").map((s) => s.name),
    technologies: (m.technologies ?? []).map((t) => t.name),
  };
}

const nodeId = (s: string) => "n_" + s.replace(/[^A-Za-z0-9]/g, "_");
const label = (s: string) => s.replace(/"/g, "'");

export function systemContextDiagram(services: ServiceSummary[], systemName: string): string {
  const names = new Set(services.map((s) => s.project));
  const lines: string[] = ["flowchart LR", `  subgraph sys["${label(systemName)}"]`];
  for (const s of services) lines.push(`    ${nodeId(s.project)}["${label(s.project)}<br/><i>service</i>"]`);
  lines.push("  end");
  for (const s of services) {
    for (const dep of s.consumes) if (names.has(dep)) lines.push(`  ${nodeId(s.project)} -->|calls| ${nodeId(dep)}`);
  }
  const drawn = new Set<string>();
  for (const s of services) {
    for (const ext of s.externals) {
      if (names.has(ext)) continue;
      if (!drawn.has(ext)) {
        lines.push(`  ${nodeId("ext_" + ext)}[/"${label(ext)}"/]`);
        drawn.add(ext);
      }
      lines.push(`  ${nodeId(s.project)} -.-> ${nodeId("ext_" + ext)}`);
    }
  }
  return lines.join("\n");
}

export interface SystemView {
  name: string;
  services: ServiceSummary[];
  mermaid: string;
  totals: { services: number; components: number; capabilities: number };
}

export function buildSystemView(models: Model[], name: string): SystemView {
  const services = models.map(summarizeService);
  return {
    name,
    services,
    mermaid: systemContextDiagram(services, name),
    totals: {
      services: services.length,
      components: services.reduce((n, s) => n + s.components, 0),
      capabilities: services.reduce((n, s) => n + s.capabilities, 0),
    },
  };
}

/** Distinct systems across the org's latest models, with service counts. */
export function listSystems(models: Model[]): { name: string; services: number }[] {
  const counts = new Map<string, number>();
  for (const m of models) if (m.system) counts.set(m.system, (counts.get(m.system) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, services]) => ({ name, services }));
}
