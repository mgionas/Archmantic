/**
 * Display-name helpers, shared by analysis (derivation) and projection so the
 * same element reads identically everywhere. Pure string functions, no deps.
 */

/** `analyzeRepo` → "Analyze repo", `tier1` → "Tier 1". */
export function humanize(raw: string): string {
  const stem = raw.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, "").split("/").pop() ?? raw;
  const words = stem
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])([0-9])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * A readable label for a component id or repo-relative path. `index` files take
 * their folder's name so `src/analyze/index.ts` reads "Analyze", not "Index".
 */
export function componentLabel(idOrRel: string): string {
  const rel = idOrRel.startsWith("comp:") ? idOrRel.slice("comp:".length) : idOrRel;
  const parts = rel.split("/");
  const stem = (parts[parts.length - 1] ?? rel).replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, "");
  if (stem === "index" && parts.length >= 2) return humanize(parts[parts.length - 2]!);
  return humanize(stem);
}
