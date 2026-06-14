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
import { terminalPreview, projectionArtifacts, buildSpecMarkdown, buildSpecJson, parseBpmnProcess, knowledgeMarkdown, applyKnowledgeBlock, readManifest, detectAgents, scaffoldManifest, MANIFEST_PATH } from "./project/index.js";
import { loadEnv } from "./env.js";
import { hasAnthropicCredentials, NO_CREDENTIAL_HINT } from "./auth.js";
import { runHandoff, runAutonomousBuild } from "./agent.js";
import { buildSystemView, systemHtml, analyzeLinks } from "./system.js";
import {
  pushModel,
  pullLatest,
  history,
  NoDatabaseError,
  hasApiToken,
  pushModelApi,
  pullLatestApi,
  pullProcessEditApi,
  recordUsage,
  recordUsageApi,
  ApiError,
} from "./cloud/index.js";
import { startMcpServer } from "./mcp/server.js";
import { readUsageLog } from "./mcp/usage.js";
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
  const seeded = scaffoldManifest(process.cwd(), project);

  console.log(`✓ Initialized Archmantic model for "${project}"`);
  console.log(`  → ${MODEL_DIR}/${MODEL_FILE}`);
  if (seeded) console.log(`  → ${MANIFEST_PATH}  (project brain: goal, author, agents — edit it)`);
  console.log(`  Next: \`archmantic analyze\` to reverse-engineer the model.`);
  return 0;
}

/** `project [--init]` — scaffold or print the human-authored project manifest. */
function cmdProject(args: string[]): number {
  const root = process.cwd();
  const project = basename(root);
  if (args.includes("--init")) {
    const created = scaffoldManifest(root, project);
    console.log(
      created
        ? `✓ Created ${MANIFEST_PATH} — edit the goal, author, links; agents auto-detect from .claude/agents/.`
        : `• ${MANIFEST_PATH} already exists — leaving it untouched.`,
    );
    return 0;
  }
  const manifest = readManifest(root);
  const agents = detectAgents(root);
  if (!manifest && !agents.length) {
    console.log(`No project manifest. Run \`archmantic project --init\` to create ${MANIFEST_PATH}.`);
    return 0;
  }
  console.log(`Project brain — ${project}`);
  if (manifest?.goal) console.log(`  goal:   ${manifest.goal}`);
  if (manifest?.status) console.log(`  status: ${manifest.status}`);
  if (manifest?.author?.name) console.log(`  author: ${manifest.author.name}`);
  const team = manifest?.agents?.length ? manifest.agents : agents;
  if (team.length) console.log(`  agents: ${team.map((a) => a.name).join(", ")}`);
  if (manifest?.links?.length) console.log(`  links:  ${manifest.links.map((l) => l.label).join(", ")}`);
  return 0;
}

function parseTier(args: string[]): number {
  const i = args.indexOf("--tier");
  if (i !== -1 && args[i + 1]) return Number(args[i + 1]) || 1;
  const inline = args.find((a) => a.startsWith("--tier="));
  if (inline) return Number(inline.split("=")[1]) || 1;
  return 1;
}

const KNOWLEDGE_FILE = "AGENTS.md";

/** Regenerate the managed Archmantic block in AGENTS.md from the model (agent context). */
function writeKnowledgeFile(root: string, model: ArchitectureModel): void {
  const file = join(root, KNOWLEDGE_FILE);
  const existing = existsSync(file) ? readFileSync(file, "utf8") : null;
  writeFileSync(file, applyKnowledgeBlock(existing, knowledgeMarkdown(model)), "utf8");
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
  writeKnowledgeFile(root, model);

  console.log(`  → ${MODEL_DIR}/${MODEL_FILE}  ·  ${KNOWLEDGE_FILE} (agent context)`);
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
  writeKnowledgeFile(root, model);

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

/** Emit an agent-consumable build spec (Markdown + JSON) from the model. */
function cmdSpec(): number {
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
  const dir = join(root, MODEL_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "build-spec.md"), buildSpecMarkdown(model) + "\n", "utf8");
  writeFileSync(join(dir, "build-spec.json"), JSON.stringify(buildSpecJson(model), null, 2) + "\n", "utf8");

  console.log(`✓ Build spec for "${model.project}"`);
  console.log(`  ${model.capabilities.length} capabilities, ${model.components.length} components`);
  console.log(`  → ${MODEL_DIR}/build-spec.md  (hand to a coding agent to implement/verify)`);
  console.log(`  → ${MODEL_DIR}/build-spec.json (machine-readable)`);
  return 0;
}

/** Regenerate the agent knowledge file (AGENTS.md managed block) from the model. */
function cmdKnowledge(): number {
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
  writeKnowledgeFile(root, model);
  console.log(`✓ Updated ${KNOWLEDGE_FILE} (agent context · managed block) for "${model.project}".`);
  console.log(`  Any agent that reads ${KNOWLEDGE_FILE} now has the current, grounded architecture.`);
  return 0;
}

/** Default verification command for the autonomous build, from package.json scripts. */
function defaultCheckCommand(root: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { scripts?: Record<string, string> };
    const s = pkg.scripts ?? {};
    const parts: string[] = [];
    if (s.build) parts.push("npm run build");
    if (s.test) parts.push("npm test");
    if (parts.length) return parts.join(" && ");
  } catch {
    /* fall through */
  }
  return "npm run build";
}

/** Multi-repo unified system view across several repos' committed models. */
function cmdSystem(args: string[]): number {
  const root = process.cwd();
  const ri = args.indexOf("--repos");
  const reposArg = ri !== -1 ? args[ri + 1] : undefined;
  if (!reposArg) {
    console.error(`✗ Usage: archmantic system [name] --repos <pathA,pathB,...>`);
    console.error(`  Each repo needs a committed ${MODEL_DIR}/${MODEL_FILE} (run \`archmantic analyze\` there).`);
    console.error(`  Declare links per repo in ${MODEL_DIR}/config.json: { "system": "...", "consumes": ["other-service"] }`);
    return 1;
  }
  const models: ArchitectureModel[] = [];
  for (const p of reposArg.split(",").map((s) => s.trim()).filter(Boolean)) {
    const mf = join(p, MODEL_DIR, MODEL_FILE);
    if (!existsSync(mf)) {
      console.error(`  ⚠ skipping ${p}: no ${MODEL_DIR}/${MODEL_FILE} (run \`archmantic analyze\` there)`);
      continue;
    }
    try {
      models.push(JSON.parse(readFileSync(mf, "utf8")) as ArchitectureModel);
    } catch {
      console.error(`  ⚠ skipping ${p}: invalid model.json`);
    }
  }
  if (!models.length) {
    console.error(`✗ No valid repo models found.`);
    return 1;
  }
  const name = args.find((a) => !a.startsWith("--") && a !== reposArg) ?? models.find((m) => m.system)?.system ?? "system";
  const view = buildSystemView(models, name);

  const dir = join(root, MODEL_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "system-context.mmd"), view.mermaid + "\n", "utf8");
  writeFileSync(join(dir, "system.html"), systemHtml(view), "utf8");

  console.log(`✓ Unified system view: "${name}"`);
  console.log(`  ${view.totals.services} services · ${view.totals.components} components · ${view.totals.capabilities} capabilities`);
  for (const s of view.services) {
    console.log(`  • ${s.project} (${s.components} comp, ${s.capabilities} cap)${s.consumes.length ? ` → ${s.consumes.join(", ")}` : ""}`);
  }
  if (view.crossServiceEdges.length) {
    console.log(`  cross-service calls: ${view.crossServiceEdges.map((e) => `${e.from}→${e.to}`).join(", ")}`);
  }

  const GREEN = "\x1b[32m";
  const YELLOW = "\x1b[33m";
  const RED = "\x1b[31m";
  const DIM = "\x1b[2m";
  const RESET = "\x1b[0m";
  const la = analyzeLinks(models);
  if (la.counts.inferred || la.counts.dangling) {
    console.log(
      `\n  Cross-repo links: ${GREEN}${la.counts.connected} connected${RESET} · ${YELLOW}${la.counts.inferred} inferred${RESET} · ${RED}${la.counts.dangling} dangling${RESET}`,
    );
    for (const l of la.links.filter((l) => l.status === "inferred")) {
      console.log(`    ${YELLOW}? ${l.from} → ${l.to}${RESET} ${DIM}${l.reason}${RESET}`);
    }
    for (const l of la.links.filter((l) => l.status === "dangling")) {
      console.log(`    ${RED}⚠ ${l.from} → ${l.to}${RESET} ${DIM}${l.reason}${RESET}`);
    }
  }
  console.log(`  → ${MODEL_DIR}/system.html (open in a browser) + system-context.mmd`);
  return 0;
}

/** Agent hand-off: run the build spec through Claude. Plan-only, or --apply to edit the repo. */
async function cmdHandoff(args: string[]): Promise<number> {
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

  const spec = buildSpecMarkdown(model);

  if (args.includes("--apply")) {
    const ci = args.indexOf("--check");
    const checkCommand = ci !== -1 && args[ci + 1] ? args[ci + 1]! : defaultCheckCommand(root);
    console.log(`⚠ Autonomous build: an agent will EDIT files in this repo to realize the model.`);
    console.log(`  Commit or stash first; review with \`git diff\` afterward.`);
    console.log(`  Verification: ${checkCommand}\n`);
    const r = await runAutonomousBuild(root, spec, model.project, checkCommand);
    if (!r.ran) {
      console.log(`⚠ Autonomous build skipped: ${r.reason}`);
      return 0;
    }
    console.log(`\n✓ Autonomous build — ${r.filesChanged.length} file(s) changed in ${r.turns} turn(s)`);
    for (const f of r.filesChanged) console.log(`  • ${f}`);
    if (r.checkPassed === true) console.log(`  ✓ verification passed`);
    else if (r.checkPassed === false) console.log(`  ⚠ verification still failing — review the diff and output`);
    console.log(`  LLM: ${r.inputTokens} in / ${r.outputTokens} out tokens · ~$${r.estCostUsd.toFixed(4)}`);
    if (r.summary) console.log(`\n${r.summary}`);
    console.log(`\n  Review with \`git diff\` before committing.`);
    return 0;
  }

  const r = await runHandoff(spec, model.project);
  if (!r.ran) {
    console.log(`⚠ Agent hand-off skipped: ${r.reason}`);
    return 0;
  }
  const dir = join(root, MODEL_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "build-plan.md"), (r.plan ?? "") + "\n", "utf8");

  console.log(`✓ Agent hand-off — implementation plan for "${model.project}"`);
  console.log(`  LLM: ${r.inputTokens} in / ${r.outputTokens} out tokens · ~$${r.estCostUsd.toFixed(4)}`);
  console.log(`  → ${MODEL_DIR}/build-plan.md  (hand to a coding agent, or run \`handoff --apply\`)`);
  return 0;
}

/** Edit-then-build: merge a human BPMN canvas edit back into the IR's process. */
async function cmdApply(args: string[]): Promise<number> {
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

  // Edit source: a local .bpmn file (self-host) or the saved cloud canvas edit.
  const fromIdx = args.indexOf("--from");
  const fromFile = fromIdx !== -1 ? args[fromIdx + 1] : undefined;
  let xml: string | null = null;
  if (fromFile) {
    if (!existsSync(fromFile)) {
      console.error(`✗ File not found: ${fromFile}`);
      return 1;
    }
    xml = readFileSync(fromFile, "utf8");
  } else if (hasApiToken()) {
    try {
      xml = await pullProcessEditApi(model.project);
    } catch (err) {
      if (err instanceof ApiError) {
        console.error(`✗ ${err.message}`);
        return 1;
      }
      throw err;
    }
  } else {
    console.error(`✗ No edit source. Pass \`--from <file.bpmn>\`, or set ARCHMANTIC_TOKEN to fetch your saved canvas edit.`);
    return 1;
  }
  if (!xml) {
    console.log(`No saved canvas edit for "${model.project}". Edit the process in the web app and Save first.`);
    return 0;
  }

  const parsed = parseBpmnProcess(xml);
  if (!parsed || !parsed.tasks.length) {
    console.error(`✗ Could not parse a process from the BPMN.`);
    return 1;
  }

  const human = { source: "human" as const, ref: "canvas-edit", confidence: 1 };
  const procId = model.processes[0]?.id ?? `proc:${model.project}`;
  model.processes = [
    {
      id: procId,
      name: parsed.name,
      description: "Human-edited process (from the BPMN canvas).",
      tasks: parsed.tasks.map((t, i) => ({ id: `task:edit:${i + 1}`, name: t.name, provenance: [human] })),
      provenance: [human],
      confidence: 1,
    },
  ];

  const dir = join(root, MODEL_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, MODEL_FILE), serializeModel({ ...model, generatedAt: new Date().toISOString() }), "utf8");

  console.log(`✓ Applied canvas edit to "${model.project}" — process "${parsed.name}" (${parsed.tasks.length} steps), human-authored.`);
  console.log(`  Steps: ${parsed.tasks.map((t) => t.name).join("  →  ")}`);
  console.log(`  Next: \`archmantic spec\` to emit a build spec reflecting your edit.`);
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

/** Show local MCP usage stats; `--sync` re-pushes the local log to the cloud. */
async function cmdUsage(args: string[]): Promise<number> {
  const root = process.cwd();
  const events = readUsageLog(root);
  if (!events.length) {
    console.log(`No MCP usage recorded yet (${MODEL_DIR}/usage.jsonl is empty).`);
    console.log(`  Usage is recorded automatically while \`archmantic mcp\` serves an agent.`);
    return 0;
  }

  const calls = events.length;
  const tokensOut = events.reduce((n, e) => n + e.tokensOut, 0);
  const tokensSaved = events.reduce((n, e) => n + e.tokensSaved, 0);
  const savedPct = tokensOut + tokensSaved === 0 ? 0 : Math.round((tokensSaved / (tokensOut + tokensSaved)) * 1000) / 10;

  const byTool = new Map<string, { calls: number; saved: number }>();
  for (const e of events) {
    const t = byTool.get(e.tool) ?? { calls: 0, saved: 0 };
    t.calls++;
    t.saved += e.tokensSaved;
    byTool.set(e.tool, t);
  }

  const BOLD = "\x1b[1m";
  const DIM = "\x1b[2m";
  const GREEN = "\x1b[32m";
  const RESET = "\x1b[0m";
  console.log(`${BOLD}MCP usage${RESET} ${DIM}— proof your agents read the model, not the files${RESET}`);
  console.log(
    `  ${BOLD}${calls}${RESET} tool calls · ${tokensOut.toLocaleString()} tokens served · ` +
      `${GREEN}${BOLD}~${tokensSaved.toLocaleString()} tokens saved${RESET} ${DIM}(${savedPct}% fewer vs reading files)${RESET}`,
  );
  console.log(`\n  ${BOLD}By tool${RESET}`);
  for (const [tool, t] of [...byTool.entries()].sort((a, b) => b[1].calls - a[1].calls)) {
    console.log(`    ${tool.padEnd(20)} ${String(t.calls).padStart(4)} calls   ${DIM}~${t.saved.toLocaleString()} saved${RESET}`);
  }

  if (args.includes("--sync")) {
    const viaApi = hasApiToken();
    if (!viaApi && !process.env.DATABASE_URL) {
      console.error(`\n✗ No cloud credentials — set ARCHMANTIC_TOKEN or DATABASE_URL to sync.`);
      return 1;
    }
    try {
      if (viaApi) await recordUsageApi(events);
      else await recordUsage(events);
    } catch (err) {
      if (err instanceof NoDatabaseError || err instanceof ApiError) {
        console.error(`\n✗ ${err.message}`);
        return 1;
      }
      throw err;
    }
    console.log(`\n✓ Synced ${calls} events to the cloud ${viaApi ? "(org-scoped API)" : "(direct)"} — see the web /usage dashboard.`);
  }
  return 0;
}

function printHelp(): void {
  console.log(`Archmantic v${pkg.version} — living architecture model for humans + agents

Usage: archmantic <command> [options]   (short alias: amt)

Commands:
  init [name]    Create an empty .archmantic/model.json (+ project.json brain)
  project [--init]  Scaffold/show the project brain (.archmantic/project.json: goal, author, agents)
  analyze [--tier N]  Reverse-engineer the model (--tier 2 adds the LLM pass, BYOK)
  update [--hook]  Incrementally re-analyze only what changed (git-diff driven)
  view           Capability map + diagrams + trust report (writes view.html)
  spec           Emit an agent-ready build spec (build-spec.md + .json)
  knowledge      Refresh AGENTS.md agent-context file (managed block; auto on analyze/update)
  apply [--from f]  Merge a human BPMN canvas edit back into the model (edit-then-build)
  handoff [--apply] [--check "<cmd>"]  Build spec → plan; --apply: agent edits repo + self-verifies (BYOK)
  system [name] --repos a,b,c  Unified cross-service view across multiple repos
  drift [--check]  Compare the committed model vs the code (--check exits 1 on drift)
  diff [<ref>]   Architecture diff: a git ref → working tree (writes pr-diff.md)
  log [-n N]     Architecture history: how the architecture changed per commit
  mcp            Start the MCP server exposing the model to AI agents (stdio)
  bench [--exact]  Token-savings benchmark: MCP queries vs raw file reads
  push           Share the model to the team cloud store (Neon) @ this commit
  pull           Fetch the team's latest shared model into .archmantic/
  cloud-log      List per-commit snapshots stored in the cloud
  usage [--sync]  MCP usage + token savings (--sync pushes the local log to the cloud)

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
    case "project":
      return cmdProject(rest);
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
    case "usage":
      return cmdUsage(rest);
    case "view":
      return cmdView();
    case "spec":
      return cmdSpec();
    case "knowledge":
      return cmdKnowledge();
    case "apply":
      return cmdApply(rest);
    case "handoff":
      return cmdHandoff(rest);
    case "system":
      return cmdSystem(rest);
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
