/**
 * Component role classifier — the *semantic* category of a source file (route,
 * page, ui, model, service…), not just its folder. Path-based and deterministic;
 * Tier-1 export info can refine it later. Drives grouping/coloring in the graph
 * and tells agents (MCP/AGENTS.md) what each component actually is.
 */

/** Roles a path already determines confidently — content can't override these. */
const STRONG_ROLES = new Set(["route", "page", "layout", "middleware", "config", "model", "store", "modal", "hook", "view"]);

/** Whether a path-derived role is weak enough to refine with file content. */
export function needsRefine(role: string): boolean {
  return !STRONG_ROLES.has(role);
}

/**
 * Refine a weak path role using content signals (route handlers, hooks, JSX
 * components, stores). Conservative: only upgrades module/ui/service/util; never
 * overrides a confident path role.
 */
export function refineRole(rel: string, content: string, pathRole: string): string {
  if (STRONG_ROLES.has(pathRole)) return pathRole;
  const head = content.slice(0, 4000);
  if (
    /\bNextResponse\b|\bNextApiRequest\b|export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE)\b|\bpublicProcedure\b|\.(?:get|post|put|patch|delete)\s*\(\s*[`'"]\//.test(
      head,
    )
  )
    return "route";
  if (/export\s+(?:async\s+)?function\s+use[A-Z]|export\s+const\s+use[A-Z]/.test(head)) return "hook";
  if (/createContext\s*\(|createSlice\s*\(|configureStore\s*\(|\bzustand\b/.test(head)) return "store";
  if (/\.tsx$/.test(rel) && /(return\s*\(?\s*<[A-Za-z>]|=>\s*\(?\s*<[A-Za-z>]|React\.FC|:\s?JSX\.Element)/.test(head))
    return "ui";
  return pathRole;
}

/** Classify a repo-relative source path into a semantic role. */
export function classifyRole(rel: string): string {
  const p = rel.toLowerCase();
  const base = p.split("/").pop() ?? p;

  // Laravel/Inertia frontend (resources/js|ts/{Pages,Layouts,Components}, .vue/.tsx).
  // Checked before the Next.js rules so `resources/js/Pages/Foo.vue` is a page.
  if (/(^|\/)resources\/(js|ts)\/pages\//.test(p)) return "page";
  if (/(^|\/)resources\/(js|ts)\/layouts\//.test(p)) return "layout";
  // Blade templates & Livewire views (server-rendered views).
  if (/\.blade\.php$/.test(p)) {
    if (/(^|\/)(layouts)\//.test(p)) return "layout";
    if (/(^|\/)(components|partials|livewire)\//.test(p)) return "ui";
    return "view";
  }
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
  if (/\.(tsx|vue)$/.test(p)) return "ui";
  // Services / libs / utils
  if (/(^|\/)(services|service|server|api|lib|libs)\//.test(p)) return "service";
  if (/(^|\/)(utils|util|helpers)\//.test(p) || /util/.test(base)) return "util";
  return "module";
}
