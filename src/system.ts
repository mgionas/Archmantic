/**
 * Multi-repo unified system view. A "system" (e.g. a set of microservices, or a
 * split front/back) is several repos; each repo's committed model declares its
 * `system` and the sibling services it `consumes` (.archmantic/config.json).
 *
 * This aggregates those per-repo models into ONE cross-service context diagram
 * (services + consumes edges + shared external systems) and a combined summary —
 * the "one unified usage view" across repos. Pure functions over the models.
 */
import { type ArchitectureModel } from "./ir/types.js";

export interface ServiceSummary {
  project: string;
  system?: string;
  consumes: string[];
  components: number;
  capabilities: number;
  externals: string[];
  technologies: string[];
}

export function summarizeService(m: ArchitectureModel): ServiceSummary {
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

/** A cross-service context diagram (Mermaid) from the services in a system. */
export function systemContextDiagram(services: ServiceSummary[], systemName: string): string {
  const names = new Set(services.map((s) => s.project));
  const lines: string[] = ["flowchart LR", `  subgraph sys["${label(systemName)}"]`];
  for (const s of services) lines.push(`    ${nodeId(s.project)}["${label(s.project)}<br/><i>service</i>"]`);
  lines.push("  end");

  // service → service edges (declared consumes that match a sibling service)
  for (const s of services) {
    for (const dep of s.consumes) {
      if (names.has(dep)) lines.push(`  ${nodeId(s.project)} -->|calls| ${nodeId(dep)}`);
    }
  }
  // shared third-party externals (exclude anything that is itself a service)
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
  crossServiceEdges: { from: string; to: string }[];
  totals: { services: number; components: number; capabilities: number };
}

export function buildSystemView(models: ArchitectureModel[], name: string): SystemView {
  const services = models.map(summarizeService);
  const names = new Set(services.map((s) => s.project));
  const crossServiceEdges = services.flatMap((s) =>
    s.consumes.filter((d) => names.has(d)).map((to) => ({ from: s.project, to })),
  );
  return {
    name,
    services,
    mermaid: systemContextDiagram(services, name),
    crossServiceEdges,
    totals: {
      services: services.length,
      components: services.reduce((n, s) => n + s.components, 0),
      capabilities: services.reduce((n, s) => n + s.capabilities, 0),
    },
  };
}

/** Self-contained HTML for the unified system view (Mermaid via CDN). */
export function systemHtml(view: SystemView): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows = view.services
    .map(
      (s) =>
        `<tr><td>${esc(s.project)}</td><td>${s.components}</td><td>${s.capabilities}</td>` +
        `<td>${esc(s.consumes.join(", ") || "—")}</td><td>${esc(s.technologies.join(", ") || "—")}</td></tr>`,
    )
    .join("\n");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Archmantic system — ${esc(view.name)}</title>
<style>body{font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#0f1115;color:#e6e9ef}
.wrap{max-width:1100px;margin:0 auto;padding:28px 32px}h1{font-size:22px}h2{font-size:16px;margin-top:28px;border-bottom:1px solid #232734;padding-bottom:8px}
.card{background:#171a21;border:1px solid #232734;border-radius:12px;padding:16px}table{width:100%;border-collapse:collapse;font-size:13px}
td,th{text-align:left;padding:8px;border-bottom:1px solid #1f232e}th{color:#8b93a7}</style></head>
<body><div class="wrap"><h1>${esc(view.name)} <span style="color:#8b93a7;font-size:13px">· unified system view</span></h1>
<div style="color:#8b93a7;font-size:13px">${view.totals.services} services · ${view.totals.components} components · ${view.totals.capabilities} capabilities</div>
<h2>Cross-service context</h2><div class="card"><pre class="mermaid">${esc(view.mermaid)}</pre></div>
<h2>Services</h2><div class="card"><table><thead><tr><th>Service</th><th>Components</th><th>Capabilities</th><th>Consumes</th><th>Stack</th></tr></thead><tbody>${rows}</tbody></table></div>
</div>
<script type="module">import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";mermaid.initialize({startOnLoad:true,theme:"dark",securityLevel:"loose"});</script>
</body></html>
`;
}
