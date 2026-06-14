// Tech-stack detection + multi-repo system view. Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeRepo } from "../dist/analyze/index.js";
import { buildSystemView, analyzeLinks } from "../dist/system.js";
import { getLinkSuggestions } from "../dist/mcp/queries.js";

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

test("analyzeLinks classifies connected / inferred / dangling", () => {
  const svc = (project, consumes, ext = []) => ({
    schemaVersion: "0.1.0",
    project,
    consumes,
    systems: ext.map((name) => ({ id: `sys:ext:${name}`, name, kind: "external", provenance: [{ source: "code", ref: name }], confidence: 0.9 })),
    components: [],
    actors: [],
    relations: [],
    flows: [],
    processes: [],
    capabilities: [],
    technologies: [],
    dataEntities: [],
    endpoints: [],
  });
  // web declares consuming "ledger-service" (no such repo → dangling) and imports
  // "@acme/payments" matching repo "payments" but doesn't declare it → inferred.
  // checkout declares consuming "payments" which exists → connected.
  const models = [
    svc("web", ["ledger-service"], ["@acme/payments", "stripe"]),
    svc("checkout", ["payments"], []),
    svc("payments", [], []),
  ];
  const la = analyzeLinks(models);
  assert.ok(la.links.find((l) => l.from === "checkout" && l.to === "payments" && l.status === "connected"));
  assert.ok(la.links.find((l) => l.from === "web" && l.to === "payments" && l.status === "inferred"));
  assert.ok(la.links.find((l) => l.from === "web" && l.to === "ledger-service" && l.status === "dangling"));
  assert.equal(la.counts.dangling, 1);
  // "stripe" matches no repo → not a link at all (just a third-party external).
  assert.ok(!la.links.some((l) => l.to === "stripe"));
});

test("getLinkSuggestions reports this repo's inferred + dangling links", () => {
  const svc = (project, consumes, ext = []) => ({
    schemaVersion: "0.1.0",
    project,
    consumes,
    systems: ext.map((name) => ({ id: `sys:ext:${name}`, name, kind: "external", provenance: [{ source: "code", ref: name }], confidence: 0.9 })),
    components: [],
    actors: [],
    relations: [],
    flows: [],
    processes: [],
    capabilities: [],
    technologies: [],
    dataEntities: [],
    endpoints: [],
  });
  const web = svc("web", ["ledger-service"], ["@acme/payments"]); // dangling + inferred
  const org = [svc("payments", [], []), svc("checkout", ["payments"], [])];
  const text = getLinkSuggestions(web, org);
  assert.match(text, /Cross-repo links for "web"/);
  assert.match(text, /Inferred/);
  assert.match(text, /\+ payments/);
  assert.match(text, /Dangling/);
  assert.match(text, /! ledger-service/);

  // With only the local model, it asks for credentials instead of guessing.
  assert.match(getLinkSuggestions(web, []), /Only this repo's model/);
});
