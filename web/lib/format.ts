import type { Element, Model } from "./store";

/** Role → accent color (shared by the component graph + facets). */
export const ROLE_COLOR: Record<string, string> = {
  route: "#f87171",
  page: "#a78bfa",
  view: "#c084fc",
  ui: "#60a5fa",
  modal: "#f472b6",
  hook: "#2dd4bf",
  store: "#fbbf24",
  model: "#4ade80",
  service: "#22d3ee",
  middleware: "#fb923c",
  layout: "#818cf8",
  config: "#94a3b8",
  util: "#cbd5e1",
  module: "#94a3b8",
  external: "#64748b",
};
/** Display order for the role legend (and the source of known role keys). */
export const ROLES = Object.keys(ROLE_COLOR).filter((r) => r !== "external");

/** Theme-aware role color (CSS var defined in globals.css, light + dark). */
export const roleColor = (r: string) => `var(--role-${r}, var(--role-module))`;

export function humanize(raw: string): string {
  const stem = (raw.replace(/\.(blade\.php|vue|tsx|ts|jsx|js|mjs|cjs)$/, "").split("/").pop() ?? raw)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])([0-9])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

/** Component label: folder-aware (`src/analyze/index.ts` → "Analyze"). */
export function componentLabel(id: string): string {
  const rel = id.startsWith("comp:") ? id.slice("comp:".length) : id;
  const parts = rel.split("/");
  const stem = (parts[parts.length - 1] ?? rel).replace(/\.(blade\.php|vue|tsx|ts|jsx|js|mjs|cjs)$/, "");
  if (stem === "index" && parts.length >= 2) return humanize(parts[parts.length - 2]!);
  return humanize(stem);
}

export type Band = "high" | "medium" | "low";
export function band(c: number): Band {
  return c >= 0.85 ? "high" : c >= 0.6 ? "medium" : "low";
}

export interface CapGroup {
  area: string;
  caps: Element[];
}
export function groupCapabilities(model: Model): CapGroup[] {
  const byArea = new Map<string, Element[]>();
  for (const cap of model.capabilities) {
    const compId = cap.componentIds?.[0] ?? "";
    const rel = compId.slice("comp:".length);
    const parts = rel.split("/");
    const area = parts.length > 1 ? parts.slice(0, -1).join("/") : "(root)";
    (byArea.get(area) ?? byArea.set(area, []).get(area)!).push(cap);
  }
  return [...byArea.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([area, caps]) => ({ area, caps }));
}

export interface TrustSummary {
  total: number;
  refs: number;
  meanPct: number;
  high: number;
  medium: number;
  low: number;
}
export function trust(model: Model): TrustSummary {
  const els: Element[] = [
    ...model.systems,
    ...model.components,
    ...model.relations,
    ...model.capabilities,
    ...model.flows,
  ];
  const s: TrustSummary = { total: 0, refs: 0, meanPct: 0, high: 0, medium: 0, low: 0 };
  let sum = 0;
  for (const el of els) {
    s.total++;
    s.refs += el.provenance?.length ?? 0;
    sum += el.confidence;
    s[band(el.confidence)]++;
  }
  s.meanPct = s.total ? Math.round((sum / s.total) * 100) : 0;
  return s;
}
