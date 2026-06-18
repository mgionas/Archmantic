/**
 * The resolver — the heart of the skills layer. Match each skill's triggers
 * against the grounded model and rank by relevance, carrying the concrete reason
 * each one matched so a recommendation is never a black box.
 */
import { type ArchitectureModel } from "../ir/types.js";
import { type Skill, type SkillMatch, type SkillTrigger } from "./types.js";

/** Per-trigger weight: specific signals (a named tech/dependency) outrank presence. */
const WEIGHT: Record<SkillTrigger["kind"], number> = {
  tech: 1,
  external: 1,
  category: 0.7,
  role: 0.6,
  entity: 0.5,
  endpoint: 0.5,
  feature: 0.5,
  process: 0.5,
  monorepo: 0.5,
  always: 0.1,
};

const has = (s: string | undefined, needle: string) => (s ?? "").toLowerCase().includes(needle.toLowerCase());

/** Evaluate one trigger against the model → a grounded reason string, or null if unmet. */
function matchTrigger(model: ArchitectureModel, t: SkillTrigger): string | null {
  const v = t.value ?? "";
  switch (t.kind) {
    case "always":
      return "applies to any project";
    case "tech": {
      const hit = (model.technologies ?? []).find((x) => has(x.name, v) || has(x.id, v));
      return hit ? `${hit.name} detected` : null;
    }
    case "category": {
      const hits = (model.technologies ?? []).filter((x) => x.category.toLowerCase() === v.toLowerCase());
      return hits.length ? `${v} present: ${hits.map((h) => h.name).join(", ")}` : null;
    }
    case "external": {
      const hit = model.systems.find((s) => s.kind === "external" && (has(s.name, v) || has(s.id, v)));
      return hit ? `external dependency: ${hit.name}` : null;
    }
    case "role": {
      const n = model.components.filter((c) => (c.role ?? "module") === v).length;
      return n ? `${n} ${v} component${n === 1 ? "" : "s"}` : null;
    }
    case "entity": {
      const n = model.dataEntities?.length ?? 0;
      return n ? `${n} data entit${n === 1 ? "y" : "ies"}` : null;
    }
    case "endpoint": {
      const n = model.endpoints?.length ?? 0;
      return n ? `${n} API endpoint${n === 1 ? "" : "s"}` : null;
    }
    case "feature": {
      const n = model.features?.length ?? 0;
      return n ? `${n} feature${n === 1 ? "" : "s"}` : null;
    }
    case "process": {
      const n = model.processes?.length ?? 0;
      return n ? "a business process is defined" : null;
    }
    case "monorepo": {
      const n = model.workspaces?.length ?? 0;
      return n ? `monorepo (${n} package${n === 1 ? "" : "s"})` : null;
    }
  }
}

/** Score one skill against the model: sum matched trigger weights, collect reasons. */
export function scoreSkill(model: ArchitectureModel, skill: Skill): SkillMatch {
  let score = 0;
  const reasons: string[] = [];
  for (const t of skill.when) {
    const reason = matchTrigger(model, t);
    if (reason) {
      score += WEIGHT[t.kind];
      if (reason !== "applies to any project" || skill.when.length === 1) reasons.push(reason);
    }
  }
  return { skill, score: Math.round(score * 100) / 100, reasons };
}

/**
 * Resolve relevant skills for a model: score every skill, keep those that matched
 * at least one trigger, and rank by score (then name). The model-driven core that
 * turns a flat shelf into "the right skill, right now, and here's why".
 */
export function resolveSkills(model: ArchitectureModel, skills: Skill[]): SkillMatch[] {
  return skills
    .map((s) => scoreSkill(model, s))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name));
}
