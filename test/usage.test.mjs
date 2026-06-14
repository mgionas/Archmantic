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

test("local-only mode still records every call (no cloud creds)", async () => {
  await withRepo(async (dir) => {
    // Simulate a local MCP server with no cloud creds: the flush is a no-op.
    const rec = new UsageRecorder(dir, () => "proj", async () => {
      /* no token / no DB → nothing flushed, must not throw or drop */
    });
    rec.record("get_context", "answer", "2026-01-01T00:00:00.000Z");
    rec.record("get_project", "answer", "2026-01-01T00:00:01.000Z");
    rec.record("list_components", "answer", "2026-01-01T00:00:02.000Z");
    await rec.stop();
    const events = readUsageLog(dir);
    assert.equal(events.length, 3, "all local calls are recorded even without cloud creds");
    assert.ok(events.every((e) => e.tokensSaved >= 0));
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

test("flushBacklog re-sends the persisted local log (catch-up after a missed flush)", async () => {
  await withRepo(async (dir) => {
    // First session: records locally but the cloud flush always fails (offline).
    const offline = new UsageRecorder(dir, () => "proj", async () => {
      throw new Error("offline");
    });
    offline.record("get_context", "answer", "2026-01-01T00:00:00.000Z");
    offline.record("get_component", "x", "2026-01-01T00:00:01.000Z");
    await offline.stop(); // drain fails → nothing reached the cloud
    assert.equal(readUsageLog(dir).length, 2, "events are durably on disk");

    // Next session in the same repo: startup catch-up re-sends the local log.
    const synced = [];
    const online = new UsageRecorder(dir, () => "proj", async (events) => {
      synced.push(...events);
    });
    const n = await online.flushBacklog();
    assert.equal(n, 2, "both pending events re-sent");
    assert.deepEqual(
      synced.map((e) => e.tool).sort(),
      ["get_component", "get_context"],
      "the missed events reach the cloud on the next start",
    );
  });
});
