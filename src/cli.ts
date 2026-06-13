#!/usr/bin/env node
/**
 * Archmantic CLI (early scaffold).
 *
 * Commands (stubs unless noted):
 *   archmantic init [name]   write an empty .archmantic/model.json   [implemented]
 *   archmantic analyze       run the tiered analysis pipeline        [stub → M1]
 *   archmantic mcp           start the MCP server over the model     [stub → M5]
 *   archmantic view [name]   preview a diagram                       [stub → M2]
 *   archmantic --version | --help
 *
 * Intentionally zero-dependency for now: builds with `tsc`, runs on plain Node.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { execFileSync } from "node:child_process";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require("../package.json") as { version: string };
import { type ArchitectureModel, createEmptyModel, serializeModel } from "./ir/types.js";
import { analyzeRepo } from "./analyze/index.js";
import { tier2 } from "./analyze/tier2.js";
import { incrementalUpdate } from "./analyze/incremental.js";
import { terminalPreview, projectionArtifacts } from "./project/index.js";
import { loadEnv } from "./env.js";
import { hasAnthropicCredentials, NO_CREDENTIAL_HINT } from "./auth.js";
import {
  pushModel,
  pullLatest,
  history,
  NoDatabaseError,
  hasApiToken,
  pushModelApi,
  pullLatestApi,
  ApiError,
} from "./cloud/index.js";
import { startMcpServer } from "./mcp/server.js";
import { runBenchmark, renderBench, estimateCounter, type TokenCounter } from "./mcp/bench.js";
import {
  diffModels,
  hasChanges,
  renderDiffText,
  renderDiffMarkdown,
  summarizeChange,
  architectureLog,
  analyzeAtRef,
  resolveRef,
  GitRefError,
} from "./diff/index.js";

const MODEL_DIR = ".archmantic";
const MODEL_FILE = "model.json";

function cmdInit(args: string[]): number {
  const project = args[0] ?? basename(process.cwd());
  const dir = join(process.cwd(), MODEL_DIR);
  const file = join(dir, MODEL_FILE);

  if (existsSync(file)) {
    console.error(`✗ ${MODEL_DIR}/${MODEL_FILE} already exists — not overwriting.`);
    return 1;
  }

  const model = { ...createEmptyModel(project), generatedAt: new Date().toISOString() };
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, serializeModel(model), "utf8");

  console.log(`✓ Initialized Archmantic model for "${project}"`);
  console.log(`  → ${MODEL_DIR}/${MODEL_FILE}`);
  console.log(`  Next: \`archmantic analyze\` to reverse-engineer the model (coming in M1).`);
  return 0;
}

function parseTier(args: string[]): number {
  const i = args.indexOf("--tier");
  if (i !== -1 && args[i + 1]) return Number(args[i + 1]) || 1;
  const inline = args.find((a) => a.startsWith("--tier="));
  if (inline) return Number(inline.split("=")[1]) || 1;
  return 1;
}

async function cmdAnalyze(args: string[]): Promise<number> {
  const root = process.cwd();
  const tier = parseTier(args);
  const model = { ...analyzeRepo(root), generatedAt: new Date().toISOString() };

  const externalSystems = model.systems.filter((s) => s.kind === "external").length;
  const internalDeps = model.relations.filter((r) => r.to.startsWith("comp:")).length;
  const externalDeps = model.relations.filter((r) => r.to.startsWith("sys:ext:")).length;

  console.log(`✓ Analyzed "${model.project}" (Tier 0 + Tier 1 + structural derivation)`);
  console.log(`  components:    ${model.components.length}`);
  console.log(`  dependencies:  ${internalDeps} internal, ${externalDeps} external`);
  console.log(`  external systems: ${externalSystems}`);
  console.log(`  capabilities:  ${model.capabilities.length}`);
  console.log(`  processes:     ${model.processes.length}, flows: ${model.flows.length}`);

  if (tier >= 2) {
    const t2 = await tier2(root, model);
    if (!t2.ran) {
      console.log(`\n⚠ Tier 2 (LLM) skipped: ${t2.reason}`);
    } else {
      console.log(`\n✓ Tier 2 (LLM semantic pass)`);
      console.log(`  refined: ${t2.capabilitiesRefined} capabilities, ${t2.componentsRefined} components` +
        `${t2.processRefined ? ", 1 process" : ""}`);
      console.log(`  LLM usage: ${t2.calls} calls · ${t2.inputTokens} in / ${t2.outputTokens} out tokens · ~$${t2.estCostUsd.toFixed(4)}`);
      if (t2.reason) console.log(`  note: ${t2.reason}`);
    }
  }

  const dir = join(root, MODEL_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, MODEL_FILE), serializeModel(model), "utf8");

  console.log(`  → ${MODEL_DIR}/${MODEL_FILE}`);
  console.log(`  Every element is grounded with file:line provenance.`);
  console.log(`  Next: \`archmantic view\` for the capability map, diagrams & trust report.`);
  return 0;
}

function cmdView(): number {
  const file = join(process.cwd(), MODEL_DIR, MODEL_FILE);
  if (!existsSync(file)) {
    console.error(`✗ No model found at ${MODEL_DIR}/${MODEL_FILE}.`);
    console.error(`  Run \`archmantic analyze\` first.`);
    return 1;
  }

  let model: ArchitectureModel;
  try {
    model = JSON.parse(readFileSync(file, "utf8")) as ArchitectureModel;
  } catch {
    console.error(`✗ ${MODEL_DIR}/${MODEL_FILE} is not valid JSON — re-run \`archmantic analyze\`.`);
    return 1;
  }

  console.log(terminalPreview(model));

  const dir = join(process.cwd(), MODEL_DIR);
  const artifacts = projectionArtifacts(model);
  for (const [name, content] of Object.entries(artifacts)) {
    writeFileSync(join(dir, name), content, "utf8");
  }
  console.log(`\n${Object.keys(artifacts).length} projections written to ${MODEL_DIR}/`);
  console.log(`  Open ${MODEL_DIR}/view.html in a browser for the full interactive view.`);
  return 0;
}

/** Drift (USP 4): the committed model snapshot vs a fresh analysis of the code. */
function cmdDrift(args: string[]): number {
  const check = args.includes("--check");
  const root = process.cwd();
  const file = join(root, MODEL_DIR, MODEL_FILE);
  if (!existsSync(file)) {
    console.error(`✗ No committed model at ${MODEL_DIR}/${MODEL_FILE} to compare against.`);
    console.error(`  Run \`archmantic analyze\` (and commit the model) first.`);
    return 1;
  }

  let snapshot: ArchitectureModel;
  try {
    snapshot = JSON.parse(readFileSync(file, "utf8")) as ArchitectureModel;
  } catch {
    console.error(`✗ ${MODEL_DIR}/${MODEL_FILE} is not valid JSON — re-run \`archmantic analyze\`.`);
    return 1;
  }

  const fresh = analyzeRepo(root);
  const diff = diffModels(snapshot, fresh, "committed model", "working tree");
  console.log(renderDiffText(diff));
  if (hasChanges(diff)) {
    console.log(`\nThe committed model is out of date. Run \`archmantic analyze\` to refresh it.`);
  }
  return check && hasChanges(diff) ? 1 : 0;
}

/** Pick a sensible base ref when none is given (a PR's target branch, usually). */
function defaultBaseRef(root: string): string | undefined {
  for (const ref of ["origin/main", "main", "origin/master", "master", "HEAD~1"]) {
    try {
      resolveRef(root, ref);
      return ref;
    } catch {
      /* try next */
    }
  }
  return undefined;
}

/** PR architecture diff (USP 5): how the working tree reshapes a base ref. */
function cmdDiff(args: string[]): number {
  const root = process.cwd();
  const baseRef = args.find((a) => !a.startsWith("-")) ?? defaultBaseRef(root);
  if (!baseRef) {
    console.error(`✗ No base ref to compare against (no main/master/previous commit found).`);
    console.error(`  Usage: archmantic diff [<git-ref>]`);
    return 1;
  }

  let base: ArchitectureModel;
  try {
    base = analyzeAtRef(root, baseRef);
  } catch (err) {
    if (err instanceof GitRefError) {
      console.error(`✗ ${err.message}`);
      return 1;
    }
    throw err;
  }

  const head = analyzeRepo(root);
  const diff = diffModels(base, head, baseRef, "working tree");
  console.log(renderDiffText(diff));

  const dir = join(root, MODEL_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "pr-diff.md"), renderDiffMarkdown(diff) + "\n", "utf8");
  console.log(`\nMarkdown report (PR-comment ready) → ${MODEL_DIR}/pr-diff.md`);
  return 0;
}

/** Architecture history: how the architecture changed over the last N commits. */
function cmdLog(args: string[]): number {
  const root = process.cwd();
  const i = args.indexOf("-n");
  const n = i !== -1 && args[i + 1] ? Math.max(1, Number(args[i + 1]) || 5) : 5;

  let changes;
  try {
    changes = architectureLog(root, n);
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
  if (!changes.length) {
    console.log("Not enough commit history to show architecture changes.");
    return 0;
  }

  const DIM = "\x1b[2m";
  const BOLD = "\x1b[1m";
  const GREEN = "\x1b[32m";
  const RESET = "\x1b[0m";
  console.log(`${BOLD}Architecture history${RESET} ${DIM}(last ${changes.length} commits, newest first)${RESET}\n`);
  for (const c of changes) {
    const summary = summarizeChange(c.diff);
    console.log(`${BOLD}${c.sha.slice(0, 7)}${RESET} ${c.subject}`);
    console.log(`  ${hasChanges(c.diff) ? GREEN + summary + RESET : DIM + summary + RESET}  ${DIM}(${c.diff.driftPct}% drift)${RESET}`);
  }
  return 0;
}

function printHookSnippet(): void {
  console.log(`# Keep the Archmantic model in sync on every commit.
# Save as .git/hooks/pre-commit and \`chmod +x\` it:

#!/bin/sh
npx archmantic update >/dev/null 2>&1
git add .archmantic/model.json`);
}

/** M6: git-diff-driven incremental re-analysis — patch the IR, refresh projections, fast. */
function cmdUpdate(args: string[]): number {
  if (args.includes("--hook")) {
    printHookSnippet();
    return 0;
  }
  const root = process.cwd();
  const file = join(root, MODEL_DIR, MODEL_FILE);
  if (!existsSync(file)) {
    console.error(`✗ No model at ${MODEL_DIR}/${MODEL_FILE}. Run \`archmantic analyze\` first.`);
    return 1;
  }
  let base: ArchitectureModel;
  try {
    base = JSON.parse(readFileSync(file, "utf8")) as ArchitectureModel;
  } catch {
    console.error(`✗ ${MODEL_DIR}/${MODEL_FILE} is not valid JSON — run \`archmantic analyze\`.`);
    return 1;
  }

  const start = Date.now();
  const { model: updated, recomputed, removed, fullFallback } = incrementalUpdate(root, base);
  const model = { ...updated, generatedAt: new Date().toISOString() };
  const ms = Date.now() - start;

  const dir = join(root, MODEL_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, MODEL_FILE), serializeModel(model), "utf8");
  for (const [name, content] of Object.entries(projectionArtifacts(model))) {
    writeFileSync(join(dir, name), content, "utf8");
  }

  console.log(`✓ Incremental update${fullFallback ? " (no git — full recompute)" : ""}`);
  console.log(
    `  recomputed ${recomputed.length} of ${model.components.length} files` +
      (removed.length ? `, removed ${removed.length}` : "") +
      ` in ${ms}ms`,
  );
  const diff = diffModels(base, model, "previous model", "updated");
  console.log(hasChanges(diff) ? "\n" + renderDiffText(diff) : "  No architecture changes since the last model.");
  console.log(`\n  → refreshed ${MODEL_DIR}/${MODEL_FILE} + projections   (\`archmantic update --hook\` for a git hook)`);
  return 0;
}

/** Start the MCP server over stdio (USP 7). Stays alive until the client disconnects. */
async function cmdMcp(): Promise<number> {
  await startMcpServer(process.cwd());
  return new Promise<number>(() => {}); // never resolve — keep the process alive for stdio
}

/** Token-savings benchmark: MCP queries vs raw file reads (the second proof). */
async function cmdBench(args: string[]): Promise<number> {
  const root = process.cwd();
  const file = join(root, MODEL_DIR, MODEL_FILE);
  if (!existsSync(file)) {
    console.error(`✗ No model at ${MODEL_DIR}/${MODEL_FILE}. Run \`archmantic analyze\` first.`);
    return 1;
  }
  const model = JSON.parse(readFileSync(file, "utf8")) as ArchitectureModel;

  let counter: TokenCounter = estimateCounter;
  let mode: "estimate" | "exact" = "estimate";
  if (args.includes("--exact")) {
    if (!hasAnthropicCredentials()) {
      console.log(`⚠ --exact needs a credential (${NO_CREDENTIAL_HINT}); using offline estimate instead.\n`);
    } else {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic();
      counter = async (t) =>
        t ? (await client.messages.countTokens({ model: "claude-opus-4-8", messages: [{ role: "user", content: t }] })).input_tokens : 0;
      mode = "exact";
    }
  }

  console.log(renderBench(await runBenchmark(root, model, counter, mode)));
  return 0;
}

// ── Cloud knowledge (shared team model over Neon) ────────────────────────────

function currentCommit(root: string): string {
  try {
    return execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "working-tree";
  }
}

function resolveProject(root: string): string {
  const mf = join(root, MODEL_DIR, MODEL_FILE);
  if (existsSync(mf)) {
    try {
      return (JSON.parse(readFileSync(mf, "utf8")) as ArchitectureModel).project;
    } catch {
      /* fall through */
    }
  }
  const pkg = join(root, "package.json");
  if (existsSync(pkg)) {
    try {
      const name = (JSON.parse(readFileSync(pkg, "utf8")) as { name?: string }).name;
      if (name) return name;
    } catch {
      /* fall through */
    }
  }
  return basename(root);
}

/** Push the committed model to the shared cloud store under the current commit. */
async function cmdPush(): Promise<number> {
  const root = process.cwd();
  const file = join(root, MODEL_DIR, MODEL_FILE);
  if (!existsSync(file)) {
    console.error(`✗ No model at ${MODEL_DIR}/${MODEL_FILE}. Run \`archmantic analyze\` first.`);
    return 1;
  }
  let model: ArchitectureModel;
  try {
    model = JSON.parse(readFileSync(file, "utf8")) as ArchitectureModel;
  } catch {
    console.error(`✗ ${MODEL_DIR}/${MODEL_FILE} is not valid JSON — run \`archmantic analyze\`.`);
    return 1;
  }
  const commit = currentCommit(root);
  const viaApi = hasApiToken();
  try {
    if (viaApi) await pushModelApi(model, commit);
    else await pushModel(model, commit);
  } catch (err) {
    if (err instanceof NoDatabaseError || err instanceof ApiError) {
      console.error(`✗ ${err.message}`);
      return 1;
    }
    throw err;
  }
  console.log(
    `✓ Pushed "${model.project}" @ ${commit.slice(0, 7)} ${viaApi ? "via the Archmantic API (org-scoped)" : "to the cloud store (direct)"}.`,
  );
  console.log(`  Teammates can \`archmantic pull\` to get the shared model.`);
  return 0;
}

/** Pull the latest shared model from the cloud into .archmantic/model.json. */
async function cmdPull(): Promise<number> {
  const root = process.cwd();
  const project = resolveProject(root);
  let model: ArchitectureModel | null;
  try {
    model = hasApiToken() ? await pullLatestApi(project) : await pullLatest(project);
  } catch (err) {
    if (err instanceof NoDatabaseError || err instanceof ApiError) {
      console.error(`✗ ${err.message}`);
      return 1;
    }
    throw err;
  }
  if (!model) {
    console.log(`No shared model for "${project}" yet. Run \`archmantic push\` first.`);
    return 0;
  }
  const dir = join(root, MODEL_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, MODEL_FILE), serializeModel(model), "utf8");
  console.log(`✓ Pulled "${project}" → ${MODEL_DIR}/${MODEL_FILE} (${model.components.length} components, ${model.capabilities.length} capabilities)`);
  console.log(`  Run \`archmantic view\` to render it.`);
  return 0;
}

/** List the per-commit snapshots stored in the cloud for this project. */
async function cmdCloudLog(): Promise<number> {
  const root = process.cwd();
  const project = resolveProject(root);
  let snaps;
  try {
    snaps = await history(project);
  } catch (err) {
    if (err instanceof NoDatabaseError) {
      console.error(`✗ ${err.message}`);
      return 1;
    }
    throw err;
  }
  if (!snaps.length) {
    console.log(`No cloud snapshots for "${project}" yet.`);
    return 0;
  }
  console.log(`Cloud knowledge history for "${project}" (${snaps.length} snapshots, newest first):`);
  for (const s of snaps) console.log(`  ${s.commit_sha.slice(0, 7)}  pushed ${s.pushed_at}`);
  return 0;
}

function notImplemented(name: string, milestone: string): number {
  console.log(`\`archmantic ${name}\` is not implemented yet (planned for ${milestone}).`);
  console.log("See docs/MVP_PLAN.md for the roadmap.");
  return 0;
}

function printHelp(): void {
  console.log(`Archmantic v${pkg.version} — living architecture model for humans + agents

Usage: archmantic <command> [options]

Commands:
  init [name]    Create an empty .archmantic/model.json (defaults name to the folder)
  analyze [--tier N]  Reverse-engineer the model (--tier 2 adds the LLM pass, BYOK)
  update [--hook]  Incrementally re-analyze only what changed (git-diff driven)
  view           Capability map + diagrams + trust report (writes view.html)
  drift [--check]  Compare the committed model vs the code (--check exits 1 on drift)
  diff [<ref>]   Architecture diff: a git ref → working tree (writes pr-diff.md)
  log [-n N]     Architecture history: how the architecture changed per commit
  mcp            Start the MCP server exposing the model to AI agents (stdio)
  bench [--exact]  Token-savings benchmark: MCP queries vs raw file reads
  push           Share the model to the team cloud store (Neon) @ this commit
  pull           Fetch the team's latest shared model into .archmantic/
  cloud-log      List per-commit snapshots stored in the cloud

Options:
  -v, --version  Print version
  -h, --help     Show this help`);
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  if (command === "-v" || command === "--version") {
    console.log(pkg.version);
    return 0;
  }
  if (!command || command === "-h" || command === "--help" || command === "help") {
    printHelp();
    return 0;
  }

  loadEnv(process.cwd());

  switch (command) {
    case "init":
      return cmdInit(rest);
    case "analyze":
      return cmdAnalyze(rest);
    case "update":
      return cmdUpdate(rest);
    case "mcp":
      return cmdMcp();
    case "bench":
      return cmdBench(rest);
    case "push":
      return cmdPush();
    case "pull":
      return cmdPull();
    case "cloud-log":
      return cmdCloudLog();
    case "view":
      return cmdView();
    case "drift":
      return cmdDrift(rest);
    case "diff":
      return cmdDiff(rest);
    case "log":
      return cmdLog(rest);
    default:
      console.error(`Unknown command: ${command}\n`);
      printHelp();
      return 1;
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
