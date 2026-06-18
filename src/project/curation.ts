/**
 * The Curate layer (Experience layer, Phase D) — the human-comprehension overlay on
 * top of the deterministic collection. Archmantic is an MCP tool, so the user's own
 * agent does the curation **on its own tokens** (read `get_architecture_map`, write
 * `curate`); a BYOK CLI `curate` is the fallback. We never run or meter an LLM.
 *
 * Curation is authored data in `.archmantic/curation.json` (agent- or human-written,
 * committed, diffable) and **merged into the model on analyze** — like the manifest
 * and features — so it survives re-derivation and the model carries it. It only
 * *names/describes/narrates* grounded elements; it never invents structure.
 * See docs/design/EXPERIENCE-LAYER.md.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type ArchitectureModel } from "../ir/types.js";

export const CURATION_PATH = join(".archmantic", "curation.json");
const CURATION_CONFIDENCE = 0.9;

/** A curated domain override (keyed by the domain group's slug). */
export interface DomainCuration {
  name?: string;
  description?: string;
}

/** The committed curation document. */
export interface Curation {
  /** One/two-paragraph "what this system is and how it's shaped" — the onboarding story. */
  overview?: string;
  /** Per-domain overrides, keyed by domain slug (the `group:domain:<slug>` suffix). */
  domains?: Record<string, DomainCuration>;
}

const domainSlug = (groupId: string) => groupId.replace(/^group:domain:/, "");

/** Read `.archmantic/curation.json`, or an empty doc if absent/malformed. */
export function readCuration(root: string): Curation {
  const file = join(root, CURATION_PATH);
  if (!existsSync(file)) return {};
  try {
    const c = JSON.parse(readFileSync(file, "utf8")) as Curation;
    return { overview: c.overview, domains: c.domains ?? {} };
  } catch {
    return {};
  }
}

/**
 * Overlay curation onto a freshly-derived model: set the positioning `narrative` and
 * override matching domain groups' name/description (provenance human → curation file).
 * Idempotent and safe to call after `deriveGroups` on every analyze.
 */
export function applyCuration(model: ArchitectureModel, curation: Curation): void {
  if (curation.overview) model.narrative = curation.overview;
  const overrides = curation.domains ?? {};
  if (!Object.keys(overrides).length) return;
  for (const g of model.groups) {
    if (g.kind !== "domain") continue;
    const o = overrides[domainSlug(g.id)];
    if (!o) continue;
    if (o.name) g.name = o.name;
    if (o.description) g.description = o.description;
    g.provenance = [{ source: "human", ref: CURATION_PATH, confidence: CURATION_CONFIDENCE }];
    g.confidence = CURATION_CONFIDENCE;
  }
}

/** Merge curation edits into `.archmantic/curation.json` (the agent's `curate` write). */
export function writeCuration(root: string, edit: Curation): Curation {
  const current = readCuration(root);
  const merged: Curation = {
    overview: edit.overview ?? current.overview,
    domains: { ...(current.domains ?? {}), ...(edit.domains ?? {}) },
  };
  const dir = join(root, ".archmantic");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(root, CURATION_PATH), JSON.stringify(merged, null, 2) + "\n", "utf8");
  return merged;
}

/** Domains that have no curated name yet (still the deterministic folder name) — what
 *  an agent should curate next. A domain is "uncurated" if no override exists for it. */
export function uncuratedDomains(model: ArchitectureModel, curation: Curation): string[] {
  const overrides = curation.domains ?? {};
  return model.groups
    .filter((g) => g.kind === "domain" && !overrides[domainSlug(g.id)]?.name)
    .map((g) => domainSlug(g.id));
}
