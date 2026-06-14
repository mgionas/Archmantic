/**
 * Component role classifier — the *semantic* category of a source file (route,
 * page, ui, model, service…), not just its folder. Path-based and deterministic;
 * Tier-1 export info can refine it later. Drives grouping/coloring in the graph
 * and tells agents (MCP/AGENTS.md) what each component actually is.
 */

/** Classify a repo-relative source path into a semantic role. */
export function classifyRole(rel: string): string {
  const p = rel.toLowerCase();
  const base = p.split("/").pop() ?? p;

  // Routing / endpoints
  if (/(^|\/)route\.[tj]sx?$/.test(p) || /(^|\/)pages\/api\//.test(p)) return "route";
  // Next.js pages
  if (/(^|\/)page\.[tj]sx?$/.test(p)) return "page";
  if (/(^|\/)pages\//.test(p) && /\.[tj]sx$/.test(p)) return "page";
  // Layout / middleware / config (structural)
  if (/(^|\/)layout\.[tj]sx?$/.test(p)) return "layout";
  if (/(^|\/)middleware\.[tj]sx?$/.test(p)) return "middleware";
  if (/\.config\.[tj]sx?$/.test(base) || /\.config\.(c|m)?js$/.test(base) || /^[\w.-]+\.config\./.test(base))
    return "config";
  // Hooks (case-sensitive useX)
  if (/(^|\/)use[A-Z]\w*\.[tj]sx?$/.test(rel) || /(^|\/)hooks\//.test(p)) return "hook";
  // State / stores
  if (/(^|\/)(store|stores|state)\//.test(p) || /(context|reducer|slice)\.[tj]sx?$/.test(base)) return "store";
  // Data model / schema
  if (/\.prisma$/.test(p) || /(^|\/)(models|entities)\//.test(p) || /\.(entity|model|schema)\.[tj]sx?$/.test(base))
    return "model";
  // Modals/dialogs (a UI sub-kind worth its own color)
  if (/(modal|dialog|drawer|popover)/.test(base)) return "modal";
  // UI components
  if (/(^|\/)components\//.test(p)) return "ui";
  if (/\.tsx$/.test(p)) return "ui";
  // Services / libs / utils
  if (/(^|\/)(services|service|server|api|lib|libs)\//.test(p)) return "service";
  if (/(^|\/)(utils|util|helpers)\//.test(p) || /util/.test(base)) return "util";
  return "module";
}
