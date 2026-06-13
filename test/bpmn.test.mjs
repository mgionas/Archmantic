// BPMN emit↔parse round-trip (edit-then-build). Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeRepo } from "../dist/analyze/index.js";
import { bpmnXml, parseBpmnProcess } from "../dist/project/index.js";

const model = analyzeRepo(process.cwd());

test("BPMN round-trips: emit then parse preserves the process name + ordered tasks", () => {
  const proc = model.processes[0];
  assert.ok(proc, "expected a derived process");
  const xml = bpmnXml(proc);
  assert.ok(xml, "expected BPMN XML");
  const parsed = parseBpmnProcess(xml);
  assert.ok(parsed, "expected a parsed process");
  assert.equal(parsed.name, proc.name);
  assert.deepEqual(
    parsed.tasks.map((t) => t.name),
    proc.tasks.map((t) => t.name),
  );
});
