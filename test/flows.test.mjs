// Feature-scoped behavior flows (spec layer phase 3). Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveFeatureFlows, processFromFlow } from "../dist/analyze/flows.js";

// A small model: Home page renders a Card and calls an external API.
function model() {
  const prov = (ref) => [{ source: "code", ref, confidence: 0.95 }];
  return {
    components: [
      { id: "comp:Home.tsx", role: "page" },
      { id: "comp:Card.tsx", role: "ui" },
    ],
    systems: [{ id: "sys:ext:axios", name: "axios", kind: "external" }],
    relations: [
      { id: "r1", from: "comp:Home.tsx", to: "comp:Card.tsx", kind: "depends_on", provenance: prov("Home.tsx:2") },
      { id: "r2", from: "comp:Home.tsx", to: "sys:ext:axios", kind: "depends_on", provenance: prov("Home.tsx:3") },
    ],
    features: [{ id: "feature:home", name: "Home", components: ["comp:Home.tsx"] }],
    flows: [],
  };
}

test("derives a flow per feature from its component subgraph", () => {
  const flows = deriveFeatureFlows(model());
  assert.equal(flows.length, 1);
  const f = flows[0];
  assert.equal(f.featureId, "feature:home");
  assert.equal(f.name, "Home flow");
  // Home renders Card, Home calls axios.
  assert.ok(f.steps.find((s) => s.participant === "comp:Home.tsx" && s.to === "comp:Card.tsx" && s.action === "renders"));
  assert.ok(f.steps.find((s) => s.to === "sys:ext:axios" && s.action === "calls"));
  assert.ok(f.participants.includes("sys:ext:axios"));
  assert.ok(f.steps.every((s) => s.provenance[0].ref.includes(":")), "grounded to file:line");
});

test("features with no edges produce no flow", () => {
  const m = model();
  m.relations = []; // Home imports nothing
  assert.deepEqual(deriveFeatureFlows(m), []);
});

test("processFromFlow turns a flow into ordered tasks", () => {
  const [flow] = deriveFeatureFlows(model());
  const proc = processFromFlow(flow);
  assert.match(proc.name, /process$/);
  assert.ok(proc.tasks.length >= 2);
  assert.equal(proc.tasks[0].name, "Home"); // componentLabel of the entry
});

test("flows are sorted richest-first", () => {
  const m = model();
  m.components.push({ id: "comp:Lonely.tsx", role: "page" });
  m.features.push({ id: "feature:lonely", name: "Lonely", components: ["comp:Lonely.tsx"] });
  m.relations.push({ id: "r3", from: "comp:Lonely.tsx", to: "comp:Card.tsx", kind: "depends_on", provenance: [{ source: "code", ref: "Lonely.tsx:1", confidence: 0.9 }] });
  const flows = deriveFeatureFlows(m);
  assert.equal(flows[0].name, "Home flow", "Home (2 steps) ranks above Lonely (1 step)");
});
