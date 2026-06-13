// Build-spec emitter. Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeRepo } from "../dist/analyze/index.js";
import { buildSpecMarkdown, buildSpecJson } from "../dist/project/index.js";

const model = analyzeRepo(process.cwd());

test("build spec markdown includes project, capabilities, and components", () => {
  const md = buildSpecMarkdown(model);
  assert.match(md, /# Build Spec — archmantic/);
  assert.match(md, /## Capabilities to implement/);
  assert.match(md, /## Components/);
});

test("build spec json is structured and grounded", () => {
  const spec = buildSpecJson(model);
  assert.equal(spec.project, "archmantic");
  assert.ok(spec.capabilities.length > 0);
  assert.ok(spec.components.length > 0);
  assert.ok(spec.capabilities.every((c) => typeof c.ref === "string" && c.ref.length > 0));
});
