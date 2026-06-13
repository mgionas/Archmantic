// Core analysis invariants. Runs against the built dist/ — no compile step,
// so it never races a `tsc --watch`. Run: `node --test test/`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeRepo } from "../dist/analyze/index.js";
import { incrementalUpdate } from "../dist/analyze/incremental.js";

const root = process.cwd();

test("analyze produces a non-empty grounded model", () => {
  const m = analyzeRepo(root);
  assert.ok(m.components.length > 0, "expected components");
  assert.ok(m.relations.length > 0, "expected relations");
  assert.ok(m.capabilities.length > 0, "expected capabilities");
  assert.equal(m.processes.length, 1);
  assert.equal(m.flows.length, 1);
});

test("provenance invariant: every derived element is grounded with a ref + valid confidence", () => {
  const m = analyzeRepo(root);
  const els = [...m.components, ...m.relations, ...m.capabilities, ...m.systems];
  for (const el of els) {
    assert.ok(Array.isArray(el.provenance) && el.provenance.length >= 1, `no provenance: ${el.id}`);
    assert.ok(el.provenance.every((p) => typeof p.ref === "string" && p.ref.length > 0), `bad ref: ${el.id}`);
    assert.ok(el.confidence >= 0 && el.confidence <= 1, `bad confidence: ${el.id}`);
  }
});

test("incremental update from an empty base equals a full analyze (id sets)", () => {
  const full = analyzeRepo(root);
  const base = {
    ...full,
    components: [],
    relations: [],
    capabilities: [],
    systems: full.systems.filter((s) => s.kind === "internal"),
    processes: [],
    flows: [],
  };
  const inc = incrementalUpdate(root, base).model;
  const ids = (m) =>
    Object.fromEntries(
      ["components", "relations", "capabilities", "systems", "processes", "flows"].map((k) => [
        k,
        m[k].map((x) => x.id).sort(),
      ]),
    );
  assert.deepEqual(ids(inc), ids(full));
});
