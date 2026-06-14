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

/** Shared third-party externals used by 2+ services (excluding sibling services). */
export function sharedExternals(services: ServiceSummary[]): string[] {
  const names = new Set(services.map((s) => s.project));
  const counts = new Map<string, number>();
  for (const s of services) for (const ext of new Set(s.externals)) {
    if (!names.has(ext)) counts.set(ext, (counts.get(ext) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n >= 2).map(([name]) => name).sort();
}

export interface SystemView {
  name: string;
  services: ServiceSummary[];
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
    crossServiceEdges,
    totals: {
      services: services.length,
      components: services.reduce((n, s) => n + s.components, 0),
      capabilities: services.reduce((n, s) => n + s.capabilities, 0),
    },
  };
}

// ── Cross-repo link auto-detection ────────────────────────────────────────────

export type LinkStatus = "connected" | "inferred" | "dangling";

export interface RepoLink {
  from: string;
  to: string;
  status: LinkStatus;
  reason: string;
}

export interface LinkAnalysis {
  repos: string[];
  links: RepoLink[];
  counts: Record<LinkStatus, number>;
}

/** Normalize a service/package name for fuzzy matching (scope + separators + common suffixes). */
function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/^@[^/]+\//, "") // drop npm scope
    .replace(/[^a-z0-9]+/g, "") // strip separators
    .replace(/(service|svc|server|api|backend|frontend|app)$/, ""); // common service suffixes
}

/**
 * Classify cross-repo links across a set of models (typically a whole org):
 *  - connected: a declared `consumes` that resolves to a repo present here
 *  - inferred:  an imported external that matches a sibling repo but isn't declared
 *  - dangling:  a declared `consumes` with no matching repo (a real gap)
 * Fuzzy matching is guarded: normalized keys shorter than 3 chars or shared by
 * multiple repos are not used (exact name match still applies).
 */
export function analyzeLinks(models: ArchitectureModel[]): LinkAnalysis {
  const repos = models.map((m) => m.project);
  const repoSet = new Set(repos);

  // Build an unambiguous fuzzy index: normalized → repo, dropping short/ambiguous keys.
  const byNorm = new Map<string, string[]>();
  for (const p of repos) {
    const n = normName(p);
    if (n.length < 3) continue;
    (byNorm.get(n) ?? byNorm.set(n, []).get(n)!).push(p);
  }
  const fuzzy = new Map<string, string>();
  for (const [n, ps] of byNorm) if (ps.length === 1) fuzzy.set(n, ps[0]!);
  const resolve = (name: string): string | undefined => {
    if (repoSet.has(name)) return name;
    const n = normName(name);
    return n.length >= 3 ? fuzzy.get(n) : undefined;
  };

  const links: RepoLink[] = [];
  const seen = new Set<string>();
  const add = (from: string, to: string, status: LinkStatus, reason: string) => {
    const key = `${from}|${to}|${status}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ from, to, status, reason });
  };

  for (const m of models) {
    const from = m.project;
    const connectedTargets = new Set<string>();
    for (const dep of m.consumes ?? []) {
      const match = resolve(dep);
      if (match) {
        add(from, match, "connected", dep === match ? "declared in consumes" : `declared consumes "${dep}" → ${match}`);
        connectedTargets.add(match);
      } else {
        add(from, dep, "dangling", `declared consumes "${dep}" — no matching repo in the org`);
      }
    }
    const externals = m.systems.filter((s) => s.kind === "external").map((s) => s.name);
    for (const ext of externals) {
      const match = resolve(ext);
      if (match && match !== from && !connectedTargets.has(match)) {
        add(from, match, "inferred", `imports "${ext}" → repo ${match} (not declared in consumes)`);
      }
    }
  }

  const counts: Record<LinkStatus, number> = {
    connected: links.filter((l) => l.status === "connected").length,
    inferred: links.filter((l) => l.status === "inferred").length,
    dangling: links.filter((l) => l.status === "dangling").length,
  };
  return { repos, links, counts };
}

/** Self-contained HTML for the unified system view. Dependency-free: the
 *  interactive cross-service graph lives in the web app; this is the local
 *  text fallback (cross-service calls + shared externals + a services table). */
export function systemHtml(view: SystemView): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows = view.services
    .map(
      (s) =>
        `<tr><td>${esc(s.project)}</td><td>${s.components}</td><td>${s.capabilities}</td>` +
        `<td>${esc(s.consumes.join(", ") || "—")}</td><td>${esc(s.technologies.join(", ") || "—")}</td></tr>`,
    )
    .join("\n");
  const calls = view.crossServiceEdges.length
    ? `<ul class="plain">${view.crossServiceEdges.map((e) => `<li>${esc(e.from)} <span class="muted">→</span> ${esc(e.to)}</li>`).join("")}</ul>`
    : `<p class="muted">No cross-service calls detected.</p>`;
  const shared = sharedExternals(view.services);
  const sharedHtml = shared.length
    ? `<p class="muted" style="margin-top:12px">Shared externals: ${shared.map((x) => esc(x)).join(", ")}</p>`
    : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Archmantic system — ${esc(view.name)}</title>
<style>body{font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#0f1115;color:#e6e9ef}
.wrap{max-width:1100px;margin:0 auto;padding:28px 32px}h1{font-size:22px}h2{font-size:16px;margin-top:28px;border-bottom:1px solid #232734;padding-bottom:8px}
.card{background:#171a21;border:1px solid #232734;border-radius:12px;padding:16px}table{width:100%;border-collapse:collapse;font-size:13px}
td,th{text-align:left;padding:8px;border-bottom:1px solid #1f232e}th{color:#8b93a7}.muted{color:#8b93a7}
ul.plain{list-style:none;margin:0;padding:0}ul.plain li{padding:6px 0;border-bottom:1px solid #1f232e}</style></head>
<body><div class="wrap"><h1>${esc(view.name)} <span style="color:#8b93a7;font-size:13px">· unified system view</span></h1>
<div style="color:#8b93a7;font-size:13px">${view.totals.services} services · ${view.totals.components} components · ${view.totals.capabilities} capabilities</div>
<h2>Cross-service calls</h2><div class="card">${calls}${sharedHtml}</div>
<h2>Services</h2><div class="card"><table><thead><tr><th>Service</th><th>Components</th><th>Capabilities</th><th>Consumes</th><th>Stack</th></tr></thead><tbody>${rows}</tbody></table></div>
</div>
</body></html>
`;
}
