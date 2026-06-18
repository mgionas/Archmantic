import type { Model } from "./store";

/**
 * Skills layer (web) — resolve the builtin skill catalog against a project's model
 * and rank by relevance with grounded reasons. Mirrors the CLI's src/skills (the
 * web app is decoupled from src/ and the hosted app only has the DB model, so it
 * resolves the shared builtin shelf — local/remote skills live on the developer's
 * disk via the CLI). Keep this in sync with src/skills/catalog.ts.
 */

export type SkillTriggerKind =
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

export interface SkillTrigger {
  kind: SkillTriggerKind;
  value?: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  body: string;
  source: "builtin";
  agent?: string;
  when: SkillTrigger[];
  tags: string[];
}

export interface SkillMatch {
  skill: Skill;
  score: number;
  reasons: string[];
}

const t = (kind: SkillTriggerKind, value?: string): SkillTrigger => (value ? { kind, value } : { kind });

const def = (
  slug: string,
  name: string,
  description: string,
  when: SkillTrigger[],
  tags: string[],
  body: string,
  agent?: string,
): Skill => ({ id: `skill:${slug}`, name, description, body: body.trim(), source: "builtin", agent, when, tags });

export const BUILTIN_SKILLS: Skill[] = [
  def(
    "api-contract-review",
    "API contract review",
    "Review the REST/tRPC/GraphQL surface for consistency, auth, and versioning.",
    [t("endpoint")],
    ["api", "review"],
    `Use the API surface from the model (get_api_surface) as the checklist.
- Verify every mutating route (POST/PUT/PATCH/DELETE) requires auth.
- Check naming/path consistency (plural nouns, no verbs in REST paths).
- Flag missing pagination on list endpoints and unbounded responses.
- Confirm error shapes and status codes are uniform across the surface.
- Note breaking changes vs the previous version; suggest a version bump if any.`,
  ),
  def(
    "data-model-migration",
    "Data model migration",
    "Plan a safe schema migration: nullability, FKs, backfills, and rollbacks.",
    [t("entity")],
    ["database", "migration"],
    `Read the data model (get_data_model) before writing any migration.
- New non-null column → add nullable + backfill + set non-null in a later step.
- Adding an FK → ensure the referenced rows exist; add an index on the FK column.
- Renames → expand/contract (add new, dual-write, migrate reads, drop old).
- Always provide a tested down/rollback path.
- Keep the migration reversible within one deploy window.`,
  ),
  def(
    "laravel-test-scaffold",
    "Laravel test scaffold",
    "Scaffold feature/unit tests for Laravel controllers, models, and routes.",
    [t("tech", "laravel")],
    ["laravel", "testing", "php"],
    `Target the routes/controllers in the model first (highest blast radius).
- Feature tests per route: happy path + auth-required + validation failure.
- Use database transactions/refresh; factories for models.
- Assert JSON shape and status codes against the API surface.
- Unit-test model scopes, accessors, and observers.
- Run with the project's test runner; aim to cover untested endpoints first.`,
    "core-engineer",
  ),
  def(
    "payment-integration-review",
    "Payment integration review",
    "Audit payment flows for idempotency, webhook verification, and secret handling.",
    [t("external", "stripe"), t("external", "paypal"), t("external", "braintree")],
    ["payments", "security", "review"],
    `Trace the payment flow through the relevant components.
- Charge/capture calls must be idempotent (idempotency keys) to survive retries.
- Verify webhook signatures; never trust unsigned callbacks.
- Reconcile webhook events against your own order state (don't double-fulfill).
- Secrets only from env; no keys in code or logs (cross-check the secret scan).
- Handle currency/amounts as integer minor units; never floats.`,
  ),
  def(
    "monorepo-dependency-map",
    "Monorepo dependency map",
    "Map cross-package dependencies, surface cycles, and tighten boundaries.",
    [t("monorepo")],
    ["monorepo", "architecture"],
    `Use the components/relations and workspace list from the model.
- Build the package dependency graph; flag any import cycles.
- Identify packages with too many dependents (change-amplifiers).
- Check for layering violations (e.g. a UI package importing infra).
- Suggest extracting shared code vs duplicating across packages.`,
  ),
  def(
    "feature-spec-writer",
    "Feature spec writer",
    "Turn seeded draft features into authored specs (description, shows, actions).",
    [t("feature")],
    ["features", "spec", "docs"],
    `Read draft features (list_features) — status "draft" means seeded, not authored.
- For each draft, write a one-paragraph description of the user-facing intent.
- Fill "Shows" (what the user sees) and "Actions" (what they can do).
- Declare dependsOn other features and the implementing components.
- Save to .archmantic/features/<slug>.md; authored files win over seeds.
- Consider archmantic feature sync to compile implied features.`,
  ),
  def(
    "auth-hardening",
    "Auth hardening review",
    "Review authentication/authorization configuration and session handling.",
    [t("category", "auth")],
    ["auth", "security", "review"],
    `Locate the auth components/config from the model.
- Enforce authorization at the route/controller layer, not just the UI.
- Check session/cookie flags (HttpOnly, Secure, SameSite) and token expiry.
- Verify password hashing (bcrypt/argon2) and rate-limited login.
- Audit role/permission checks for privilege escalation gaps.`,
  ),
  def(
    "security-review",
    "Security review",
    "Baseline security pass: secrets, input validation, dependencies, and authz.",
    [t("always")],
    ["security", "review"],
    `A baseline applicable to any repo.
- Scan for committed secrets/credentials and real values in env-like files.
- Validate and sanitize all external input; parameterize DB queries.
- Check authorization on every state-changing path.
- Review dependency risk (known-vuln packages, unmaintained deps).
- Confirm error messages don't leak internals (stack traces, SQL).`,
  ),
];

const WEIGHT: Record<SkillTriggerKind, number> = {
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

/** Evaluate one trigger against the model → a grounded reason string, or null. */
function matchTrigger(model: Model, trigger: SkillTrigger): string | null {
  const v = trigger.value ?? "";
  switch (trigger.kind) {
    case "always":
      return "applies to any project";
    case "tech": {
      const hit = (model.technologies ?? []).find((x) => has(x.name, v));
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

function scoreSkill(model: Model, skill: Skill): SkillMatch {
  let score = 0;
  const reasons: string[] = [];
  for (const trig of skill.when) {
    const reason = matchTrigger(model, trig);
    if (reason) {
      score += WEIGHT[trig.kind];
      if (reason !== "applies to any project" || skill.when.length === 1) reasons.push(reason);
    }
  }
  return { skill, score: Math.round(score * 100) / 100, reasons };
}

/** Rank the builtin shelf against a model: matched skills, highest relevance first. */
export function resolveSkills(model: Model, skills: Skill[] = BUILTIN_SKILLS): SkillMatch[] {
  return skills
    .map((s) => scoreSkill(model, s))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name));
}

/** Render a trigger as `kind:value` (or bare `kind`). */
export const triggerLabel = (trigger: SkillTrigger): string =>
  trigger.value ? `${trigger.kind}:${trigger.value}` : trigger.kind;
