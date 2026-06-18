// Skills layer — catalog, parser, and model-driven resolver. Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUILTIN_SKILLS,
  resolveSkills,
  scoreSkill,
  parseSkillFile,
  parseTrigger,
  skillSlug,
  findSkill,
  renderSuggestions,
  renderSkillList,
  renderSkill,
} from "../dist/skills/index.js";

/** A minimal model with just the fields the resolver reads. */
function model(overrides = {}) {
  return {
    project: "demo",
    systems: [],
    components: [],
    relations: [],
    flows: [],
    processes: [],
    capabilities: [],
    technologies: [],
    dataEntities: [],
    endpoints: [],
    features: [],
    ...overrides,
  };
}

test("builtin catalog: every skill is well-formed", () => {
  assert.ok(BUILTIN_SKILLS.length >= 5, "ships a non-trivial shelf");
  for (const s of BUILTIN_SKILLS) {
    assert.match(s.id, /^skill:[a-z0-9-]+$/);
    assert.equal(s.source, "builtin");
    assert.ok(s.name && s.description && s.body, `${s.id} has name/description/body`);
    assert.ok(s.when.length, `${s.id} has at least one trigger`);
  }
  // ids are unique
  const ids = BUILTIN_SKILLS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "skill ids are unique");
});

test("parseTrigger: kind and kind:value, drops unknown kinds", () => {
  assert.deepEqual(parseTrigger("entity"), { kind: "entity" });
  assert.deepEqual(parseTrigger("tech:laravel"), { kind: "tech", value: "laravel" });
  assert.deepEqual(parseTrigger("external:Stripe"), { kind: "external", value: "Stripe" });
  assert.equal(parseTrigger("bogus"), null);
});

test("parseSkillFile: frontmatter + body → Skill", () => {
  const text = `---
name: My Skill
description: Does a thing
agent: core-engineer
tags: [a, b]
when: [tech:laravel, entity, external:stripe]
---
Step one.
Step two.`;
  const s = parseSkillFile(text, "my-skill", ".archmantic/skills/my-skill.md");
  assert.equal(s.id, "skill:my-skill");
  assert.equal(s.name, "My Skill");
  assert.equal(s.description, "Does a thing");
  assert.equal(s.agent, "core-engineer");
  assert.deepEqual(s.tags, ["a", "b"]);
  assert.equal(s.source, "local");
  assert.deepEqual(s.when, [
    { kind: "tech", value: "laravel" },
    { kind: "entity" },
    { kind: "external", value: "stripe" },
  ]);
  assert.match(s.body, /Step one/);
});

test("parseSkillFile: no `when` defaults to always", () => {
  const s = parseSkillFile(`---\nname: Bare\n---\nbody`, "bare", "x");
  assert.deepEqual(s.when, [{ kind: "always" }]);
});

test("resolver: matches with grounded reasons, ranks specific over baseline", () => {
  const m = model({
    technologies: [{ id: "tech:laravel", name: "Laravel", category: "framework", provenance: [], confidence: 1 }],
    dataEntities: [{ id: "e1", name: "User", fields: [], provenance: [], confidence: 1 }],
    systems: [{ id: "sys:ext:stripe", name: "Stripe", kind: "external", provenance: [], confidence: 1 }],
  });
  const matches = resolveSkills(m, BUILTIN_SKILLS);
  const names = matches.map((x) => x.skill.name);
  assert.ok(names.includes("Laravel test scaffold"), "Laravel skill surfaces");
  assert.ok(names.includes("Data model migration"), "entity skill surfaces");
  assert.ok(names.includes("Payment integration review"), "stripe skill surfaces");

  // Every match carries a concrete, grounded reason.
  const laravel = matches.find((x) => x.skill.name === "Laravel test scaffold");
  assert.match(laravel.reasons.join(" "), /Laravel detected/);
  const stripe = matches.find((x) => x.skill.name === "Payment integration review");
  assert.match(stripe.reasons.join(" "), /Stripe/);

  // A specific (tech/external) match must outrank the always-on baseline.
  const security = matches.find((x) => x.skill.name === "Security review");
  assert.ok(laravel.score > security.score, "specific skill ranks above baseline");
});

test("resolver: an empty project still gets the baseline skill, nothing irrelevant", () => {
  const matches = resolveSkills(model(), BUILTIN_SKILLS);
  assert.deepEqual(matches.map((m) => m.skill.name), ["Security review"]);
  assert.deepEqual(matches[0].reasons, ["applies to any project"]);
});

test("scoreSkill: unmet triggers contribute nothing", () => {
  const m = model(); // no tech, no entities
  const laravel = BUILTIN_SKILLS.find((s) => s.id === "skill:laravel-test-scaffold");
  assert.equal(scoreSkill(m, laravel).score, 0);
});

test("findSkill: by id, slug, and display name", () => {
  assert.equal(findSkill(BUILTIN_SKILLS, "skill:security-review")?.id, "skill:security-review");
  assert.equal(findSkill(BUILTIN_SKILLS, "security-review")?.id, "skill:security-review");
  assert.equal(findSkill(BUILTIN_SKILLS, "Security review")?.id, "skill:security-review");
  assert.equal(findSkill(BUILTIN_SKILLS, "nope"), undefined);
});

test("skillSlug: kebab-cases names", () => {
  assert.equal(skillSlug("My Cool Skill!"), "my-cool-skill");
  assert.equal(skillSlug("  "), "skill");
});

test("renderers: suggestions, list, and one skill", () => {
  const m = model({
    technologies: [{ id: "tech:laravel", name: "Laravel", category: "framework", provenance: [], confidence: 1 }],
  });
  const sugg = renderSuggestions(m, BUILTIN_SKILLS);
  assert.match(sugg, /Recommended skills for "demo"/);
  assert.match(sugg, /why:/);

  const list = renderSkillList(BUILTIN_SKILLS);
  assert.match(list, /builtin/);
  assert.match(list, /when:/);

  const one = renderSkill(BUILTIN_SKILLS.find((s) => s.id === "skill:security-review"));
  assert.match(one, /Skill: Security review/);
  assert.match(one, /Applies when: always/);
});
