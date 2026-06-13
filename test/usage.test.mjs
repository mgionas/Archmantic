// MCP usage recorder: estimation, local log, flush. Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { UsageRecorder, readUsageLog } from "../dist/mcp/usage.js";

async function withRepo(fn) {
  const dir = mkdtempSync(join(tmpdir(), "archmantic-usage-"));
  try {
    mkdirSync(join(dir, "src"));
    // Give srcTokens something to measure, so tokensSaved > 0.
    writeFileSync(join(dir, "src", "big.ts"), "export const x = 1;\n".repeat(500));
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("records events to the local log with estimated savings", async () => {
  await withRepo(async (dir) => {
    const rec = new UsageRecorder(dir, () => "proj", async () => {});
    rec.record("get_context", "a short MCP answer", "2026-01-01T00:00:00.000Z");
    rec.record("get_component", "x", "2026-01-01T00:00:01.000Z");
    await rec.stop();

    const events = readUsageLog(dir);
    assert.equal(events.length, 2);
    assert.ok(events.every((e) => e.project === "proj" && e.id && e.at));
    const ctx = events.find((e) => e.tool === "get_context");
    const comp = events.find((e) => e.tool === "get_component");
    assert.ok(ctx.tokensSaved > 0, "broad tool saves tokens vs reading files");
    // A broad tool baselines against the whole repo; a component tool a fraction.
    assert.ok(ctx.tokensSaved > comp.tokensSaved, "broad savings exceed component-level savings");
  });
});

test("flushes a batch to the cloud once the threshold is hit", async () => {
  await withRepo(async (dir) => {
    let flushed = 0;
    const rec = new UsageRecorder(dir, () => "proj", async (events) => {
      flushed += events.length;
    });
    for (let i = 0; i < 5; i++) rec.record("get_context", "answer", "2026-01-01T00:00:00.000Z");
    await rec.stop(); // drains any remainder
    assert.equal(flushed, 5, "all 5 events flushed");
  });
});
