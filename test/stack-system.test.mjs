// Tech-stack detection + multi-repo system view. Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeRepo } from "../dist/analyze/index.js";
import { buildSystemView } from "../dist/system.js";

test("stack detection classifies known dependencies", () => {
  const m = analyzeRepo(process.cwd());
  assert.ok(m.technologies.length > 0, "expected technologies");
  const names = m.technologies.map((t) => t.name);
  assert.ok(names.includes("Anthropic"), "expected Anthropic in stack");
  assert.ok(names.includes("Neon"), "expected Neon in stack");
  assert.ok(m.technologies.every((t) => t.category && (t.provenance?.length ?? 0) > 0), "grounded + categorized");
});

test("unified system view links services by declared consumes", () => {
  const svc = (project, system, consumes, ext = []) => ({
    schemaVersion: "0.1.0",
    project,
    system,
    consumes,
    systems: ext.map((name) => ({ id: `sys:ext:${name}`, name, kind: "external", provenance: [{ source: "code", ref: name }], confidence: 0.9 })),
    components: [{ id: `comp:${project}.ts` }],
    actors: [],
    relations: [],
    flows: [],
    processes: [],
    capabilities: [{ id: `cap:${project}` }],
    technologies: [],
  });
  const view = buildSystemView([svc("web", "shop", ["api"], ["stripe"]), svc("api", "shop", [], [])], "shop");
  assert.equal(view.totals.services, 2);
  assert.deepEqual(view.crossServiceEdges, [{ from: "web", to: "api" }]);
  assert.match(view.mermaid, /calls/); // service→service edge rendered
  assert.match(view.mermaid, /stripe/); // shared external rendered
});
