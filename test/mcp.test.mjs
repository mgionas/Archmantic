// Naming, MCP queries, and the token-savings benchmark. Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeRepo } from "../dist/analyze/index.js";
import { getContext, searchCapabilities } from "../dist/mcp/queries.js";
import { runBenchmark, estimateCounter } from "../dist/mcp/bench.js";
import { componentLabel, humanize } from "../dist/ir/naming.js";

const root = process.cwd();

test("naming helpers humanize symbols and folder-aware index files", () => {
  assert.equal(humanize("analyzeRepo"), "Analyze Repo");
  assert.equal(componentLabel("comp:src/cli.ts"), "Cli");
  assert.equal(componentLabel("comp:src/analyze/index.ts"), "Analyze");
});

test("MCP queries return grounded, non-empty answers", () => {
  const m = analyzeRepo(root);
  assert.match(getContext(m), /Project: archmantic/);
  assert.ok(searchCapabilities(m, "").split("\n").length > 1);
});

test("benchmark shows substantial token savings via MCP", async () => {
  const m = analyzeRepo(root);
  const report = await runBenchmark(root, m, estimateCounter, "estimate");
  assert.ok(report.savedPct > 50, `expected >50% savings, got ${report.savedPct}%`);
});
