// Semantic grouping (domains + layers) for the Architecture Map. Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveGroups } from "../dist/analyze/groups.js";

/** A model with just the components the grouper reads. */
function model(comps) {
  return {
    project: "demo",
    systems: [],
    components: comps.map(([rel, role]) => ({
      id: `comp:${rel}`,
      name: rel,
      kind: "module",
      role,
      provenance: [{ source: "code", ref: rel, confidence: 1 }],
      confidence: 1,
    })),
    groups: [],
    actors: [],
    relations: [],
    flows: [],
    processes: [],
    capabilities: [],
    technologies: [],
    dataEntities: [],
    endpoints: [],
    features: [],
  };
}

test("domains derive from the first meaningful folder; components get groupId", () => {
  const m = model([
    ["src/pay/charge.ts", "service"],
    ["src/pay/refund.ts", "service"],
    ["src/auth/login.ts", "service"],
    ["src/auth/session.ts", "service"],
  ]);
  deriveGroups(m, []);
  const domains = m.groups.filter((g) => g.kind === "domain");
  const names = domains.map((g) => g.name).sort();
  assert.deepEqual(names, ["Auth", "Pay"]);
  const pay = domains.find((g) => g.name === "Pay");
  assert.equal(pay.members.length, 2);
  // every component points at its domain group
  const charge = m.components.find((c) => c.id === "comp:src/pay/charge.ts");
  assert.equal(charge.groupId, pay.id);
});

test("layers derive from role with presentation-first ordering", () => {
  const m = model([
    ["src/app/page.tsx", "page"],
    ["src/api/route.ts", "route"],
    ["src/pay/service.ts", "service"],
    ["src/db/user.ts", "model"],
  ]);
  deriveGroups(m, []);
  const layers = m.groups.filter((g) => g.kind === "layer");
  const byName = Object.fromEntries(layers.map((g) => [g.name, g.order]));
  assert.equal(byName["Presentation"], 0);
  assert.equal(byName["API"], 1);
  assert.equal(byName["Domain"], 3);
  assert.equal(byName["Data"], 4);
});

test("singleton domains collapse into Misc (clusters, not confetti)", () => {
  const m = model([
    ["src/pay/a.ts", "service"],
    ["src/pay/b.ts", "service"],
    ["src/lonely/x.ts", "service"], // singleton domain → Misc
    ["src/cli.ts", "module"], // top-level file → "root" (also a singleton → Misc)
  ]);
  deriveGroups(m, []);
  const domainNames = m.groups.filter((g) => g.kind === "domain").map((g) => g.name).sort();
  assert.ok(domainNames.includes("Pay"));
  assert.ok(domainNames.includes("Misc"), "singletons collapse into Misc");
  assert.ok(!domainNames.includes("Lonely"), "no singleton domain survives");
});

test("monorepo: the workspace package is the domain", () => {
  const m = model([
    ["apps/web/page.tsx", "page"],
    ["apps/web/layout.tsx", "layout"],
    ["apps/api/route.ts", "route"],
    ["apps/api/service.ts", "service"],
  ]);
  deriveGroups(m, ["apps/web", "apps/api"]);
  const domains = m.groups.filter((g) => g.kind === "domain").map((g) => g.name).sort();
  assert.deepEqual(domains, ["Api", "Web"]);
});

test("deriveGroups is idempotent (clears before rebuild)", () => {
  const m = model([["src/pay/a.ts", "service"], ["src/pay/b.ts", "service"]]);
  deriveGroups(m, []);
  const n = m.groups.length;
  deriveGroups(m, []);
  assert.equal(m.groups.length, n, "second run does not duplicate groups");
});
