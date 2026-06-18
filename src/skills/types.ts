/**
 * Skills layer — an on-shelf catalog of reusable playbooks/agents that Archmantic
 * resolves *against the grounded model*: given a repo's detected stack, data model,
 * API surface, externals and features, which skills are relevant — and why.
 *
 * Skills are data, never executed here. `suggest_skills` recommends; the agent (or
 * human) decides whether to apply one. Supply has three layers: builtin (bundled),
 * local (`.archmantic/skills/*.md`, authored or fetched), and remote (pulled on
 * demand via `archmantic skill add <url>`). See docs/design/SPEC-LAYER.md.
 */

/** Where a skill came from. */
export type SkillSource = "builtin" | "local";

/**
 * A declarative trigger predicate matched against model facts. Kept deliberately
 * small and grounded so every recommendation can cite a concrete reason.
 *   tech:<name>      a detected technology matches (e.g. tech:laravel)
 *   category:<cat>   a technology category is present (orm | auth | ai | testing | …)
 *   external:<name>  an external system/dependency is present (e.g. external:stripe)
 *   role:<role>      components with a given role exist (e.g. role:page)
 *   entity|endpoint|feature|process   that part of the model is non-empty
 *   monorepo         the project is a monorepo (workspaces declared)
 *   always           applies to any project (baseline skills)
 */
export interface SkillTrigger {
  kind:
    | "tech"
    | "category"
    | "external"
    | "role"
    | "entity"
    | "endpoint"
    | "feature"
    | "process"
    | "monorepo"
    | "always";
  /** value for tech/category/external/role; unused for presence/always. */
  value?: string;
}

/** A skill definition — a playbook the agent can apply, with its match triggers. */
export interface Skill {
  id: string;
  name: string;
  description?: string;
  /** The playbook body an agent applies when it uses the skill. */
  body?: string;
  source: SkillSource;
  /** Provenance: "builtin", a local file path, or the URL it was fetched from. */
  origin: string;
  /** Optional subagent type to run this skill (advisory; not auto-invoked). */
  agent?: string;
  /** Conditions under which this skill is relevant. */
  when: SkillTrigger[];
  tags: string[];
}

/** A skill matched against a model, with its score and the grounded reasons. */
export interface SkillMatch {
  skill: Skill;
  score: number;
  /** Human-readable, grounded reasons it matched (e.g. "Laravel detected"). */
  reasons: string[];
}
