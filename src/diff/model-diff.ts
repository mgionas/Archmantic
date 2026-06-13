/**
 * Architecture diff — compare two grounded models (USP 4 drift detection, USP 5
 * PR architecture diff). Both features are the same operation: diff two
 * `ArchitectureModel`s by stable id and report what changed at the *architecture*
 * level (components, dependencies, external systems, capabilities) — not lines.
 *
 * Pure functions over the IR; the CLI decides which two models to compare
 * (committed snapshot vs working tree, or git-ref vs working tree).
 */
import { type ArchitectureModel, type Relation } from "../ir/types.js";
import { componentLabel } from "../ir/naming.js";

export interface ElementChange {
  id: string;
  /** Human label for the element. */
  label: string;
  /** A grounding ref if we have one (e.g. "src/x.ts:12"). */
  ref?: string;
}

export interface CategoryDiff {
  added: ElementChange[];
  removed: ElementChange[];
}

export interface ModelDiff {
  baseLabel: string;
  headLabel: string;
  components: CategoryDiff;
  dependencies: CategoryDiff;
  externalSystems: CategoryDiff;
  capabilities: CategoryDiff;
  /** Count of added+removed across all tracked categories. */
  changedCount: number;
  /** Size of the union of element ids across both models. */
  totalCount: number;
  /** changedCount / totalCount, 0..100. 0 = perfectly in sync. */
  driftPct: number;
}

const firstRef = (el: { provenance: { ref: string }[] }): string | undefined => el.provenance[0]?.ref;

/** A short "from → to" label for a dependency relation. */
function relationLabel(r: Relation): string {
  const side = (id: string) =>
    id.startsWith("comp:") ? componentLabel(id) : id.startsWith("sys:ext:") ? id.slice("sys:ext:".length) : id;
  return `${side(r.from)} → ${side(r.to)}`;
}

interface Grouped {
  components: Map<string, ElementChange>;
  dependencies: Map<string, ElementChange>;
  externalSystems: Map<string, ElementChange>;
  capabilities: Map<string, ElementChange>;
}

function group(model: ArchitectureModel): Grouped {
  const components = new Map<string, ElementChange>();
  for (const c of model.components) {
    components.set(c.id, { id: c.id, label: componentLabel(c.id), ref: firstRef(c) });
  }
  const dependencies = new Map<string, ElementChange>();
  for (const r of model.relations) {
    dependencies.set(r.id, { id: r.id, label: relationLabel(r), ref: firstRef(r) });
  }
  const externalSystems = new Map<string, ElementChange>();
  for (const s of model.systems) {
    if (s.kind === "external") externalSystems.set(s.id, { id: s.id, label: s.name, ref: firstRef(s) });
  }
  const capabilities = new Map<string, ElementChange>();
  for (const cap of model.capabilities) {
    capabilities.set(cap.id, { id: cap.id, label: cap.name, ref: firstRef(cap) });
  }
  return { components, dependencies, externalSystems, capabilities };
}

function categoryDiff(base: Map<string, ElementChange>, head: Map<string, ElementChange>): CategoryDiff {
  const added: ElementChange[] = [];
  const removed: ElementChange[] = [];
  for (const [id, el] of head) if (!base.has(id)) added.push(el);
  for (const [id, el] of base) if (!head.has(id)) removed.push(el);
  const byLabel = (a: ElementChange, b: ElementChange) => a.label.localeCompare(b.label);
  return { added: added.sort(byLabel), removed: removed.sort(byLabel) };
}

export function diffModels(
  base: ArchitectureModel,
  head: ArchitectureModel,
  baseLabel = "base",
  headLabel = "head",
): ModelDiff {
  const b = group(base);
  const h = group(head);

  const components = categoryDiff(b.components, h.components);
  const dependencies = categoryDiff(b.dependencies, h.dependencies);
  const externalSystems = categoryDiff(b.externalSystems, h.externalSystems);
  const capabilities = categoryDiff(b.capabilities, h.capabilities);

  const cats = [components, dependencies, externalSystems, capabilities];
  const changedCount = cats.reduce((n, c) => n + c.added.length + c.removed.length, 0);

  const unionIds = new Set<string>();
  for (const m of [b, h]) {
    for (const map of [m.components, m.dependencies, m.externalSystems, m.capabilities]) {
      for (const id of map.keys()) unionIds.add(id);
    }
  }
  const totalCount = unionIds.size;
  const driftPct = totalCount === 0 ? 0 : Math.round((changedCount / totalCount) * 1000) / 10;

  return {
    baseLabel,
    headLabel,
    components,
    dependencies,
    externalSystems,
    capabilities,
    changedCount,
    totalCount,
    driftPct,
  };
}

export function hasChanges(diff: ModelDiff): boolean {
  return diff.changedCount > 0;
}

/** One-line summary like "+3 components, +12 deps, -1 capabilities". */
export function summarizeChange(d: ModelDiff): string {
  const parts: string[] = [];
  const add = (cat: "components" | "dependencies" | "externalSystems" | "capabilities", label: string) => {
    if (d[cat].added.length) parts.push(`+${d[cat].added.length} ${label}`);
    if (d[cat].removed.length) parts.push(`-${d[cat].removed.length} ${label}`);
  };
  add("components", "components");
  add("dependencies", "deps");
  add("externalSystems", "ext");
  add("capabilities", "capabilities");
  return parts.length ? parts.join(", ") : "no architecture change";
}

// ── Renderers ───────────────────────────────────────────────────────────────

const CATEGORY_TITLES: [keyof Pick<ModelDiff, "components" | "dependencies" | "externalSystems" | "capabilities">, string][] = [
  ["components", "Components"],
  ["dependencies", "Dependencies"],
  ["externalSystems", "External systems"],
  ["capabilities", "Capabilities"],
];

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

/** Terminal-friendly diff report. */
export function renderDiffText(diff: ModelDiff): string {
  const out: string[] = [];
  const verdict = diff.driftPct === 0 ? "in sync ✓" : `${diff.driftPct}% drift`;
  out.push(`${BOLD}Architecture diff${RESET} ${DIM}${diff.baseLabel} → ${diff.headLabel}${RESET}`);
  out.push(`${diff.changedCount} change${diff.changedCount === 1 ? "" : "s"} across ${diff.totalCount} elements — ${verdict}`);

  for (const [key, title] of CATEGORY_TITLES) {
    const cat = diff[key];
    if (!cat.added.length && !cat.removed.length) continue;
    out.push(`\n${BOLD}${title}${RESET}`);
    for (const el of cat.added) out.push(`  ${GREEN}+ ${el.label}${RESET}${el.ref ? ` ${DIM}(${el.ref})${RESET}` : ""}`);
    for (const el of cat.removed) out.push(`  ${RED}- ${el.label}${RESET}${el.ref ? ` ${DIM}(${el.ref})${RESET}` : ""}`);
  }
  if (diff.changedCount === 0) out.push(`\n${DIM}No architecture-level changes.${RESET}`);
  return out.join("\n");
}

/** Markdown report — ready to post as a PR comment ("architecture code review"). */
export function renderDiffMarkdown(diff: ModelDiff): string {
  const out: string[] = [];
  const verdict = diff.driftPct === 0 ? "**in sync** ✅" : `**${diff.driftPct}% architecture drift**`;
  out.push(`## 🏛️ Architecture diff — \`${diff.baseLabel}\` → \`${diff.headLabel}\``);
  out.push("");
  out.push(`${diff.changedCount} change${diff.changedCount === 1 ? "" : "s"} across ${diff.totalCount} elements — ${verdict}`);

  for (const [key, title] of CATEGORY_TITLES) {
    const cat = diff[key];
    if (!cat.added.length && !cat.removed.length) continue;
    out.push("");
    out.push(`### ${title}`);
    for (const el of cat.added) out.push(`- 🟢 **added** ${el.label}${el.ref ? ` <sub>\`${el.ref}\`</sub>` : ""}`);
    for (const el of cat.removed) out.push(`- 🔴 **removed** ${el.label}${el.ref ? ` <sub>\`${el.ref}\`</sub>` : ""}`);
  }
  if (diff.changedCount === 0) {
    out.push("");
    out.push("_No architecture-level changes._");
  }
  out.push("");
  out.push(`<sub>Generated by [Archmantic](https://github.com/mgionas/Archmantic) — diffs the grounded architecture model, not lines.</sub>`);
  return out.join("\n");
}
