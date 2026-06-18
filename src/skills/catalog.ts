/**
 * The built-in skill catalog — the on-shelf set Archmantic ships. Each is a small
 * playbook with grounded triggers so the resolver only surfaces it when the model
 * shows it's relevant. Bundled as data (no file IO, no network); teams extend the
 * shelf with `.archmantic/skills/*.md` (local) or `archmantic skill add <url>`.
 */
import { type Skill, type SkillTrigger } from "./types.js";

const t = (kind: SkillTrigger["kind"], value?: string): SkillTrigger => (value ? { kind, value } : { kind });

const def = (
  slug: string,
  name: string,
  description: string,
  when: SkillTrigger[],
  tags: string[],
  body: string,
  agent?: string,
): Skill => ({
  id: `skill:${slug}`,
  name,
  description,
  body: body.trim(),
  source: "builtin",
  origin: "builtin",
  agent,
  when,
  tags,
});

export const BUILTIN_SKILLS: Skill[] = [
  def(
    "api-contract-review",
    "API contract review",
    "Review the REST/tRPC/GraphQL surface for consistency, auth, and versioning.",
    [t("endpoint")],
    ["api", "review"],
    `Use the API surface from the model (\`get_api_surface\`) as the checklist.
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
    `Read the data model (\`get_data_model\`) before writing any migration.
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
    `Read draft features (\`list_features\`) — status "draft" means seeded, not authored.
- For each draft, write a one-paragraph description of the user-facing intent.
- Fill "Shows" (what the user sees) and "Actions" (what they can do).
- Declare dependsOn other features and the implementing components.
- Save to .archmantic/features/<slug>.md; authored files win over seeds.
- Consider \`archmantic feature sync\` to compile implied features.`,
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
