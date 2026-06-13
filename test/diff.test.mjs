// Architecture diff engine. Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { diffModels, summarizeChange, hasChanges } from "../dist/diff/model-diff.js";

const model = (compIds) => ({
  schemaVersion: "0.1.0",
  project: "t",
  systems: [],
  components: compIds.map((id) => ({
    id,
    name: id,
    kind: "module",
    provenance: [{ source: "code", ref: id.slice("comp:".length) + ":1" }],
    confidence: 0.9,
  })),
  actors: [],
  relations: [],
  flows: [],
  processes: [],
  capabilities: [],
});

test("diffModels detects added and removed components", () => {
  const d = diffModels(model(["comp:a.ts", "comp:b.ts"]), model(["comp:a.ts", "comp:c.ts"]));
  assert.equal(d.components.added.length, 1);
  assert.equal(d.components.removed.length, 1);
  assert.ok(hasChanges(d));
  assert.ok(d.driftPct > 0);
});

test("identical models report no changes", () => {
  const d = diffModels(model(["comp:a.ts"]), model(["comp:a.ts"]));
  assert.equal(d.changedCount, 0);
  assert.equal(hasChanges(d), false);
  assert.equal(summarizeChange(d), "no architecture change");
});
