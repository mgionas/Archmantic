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
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require("../package.json") as { version: string };
import { type ArchitectureModel, createEmptyModel } from "./ir/types.js";
import { analyzeRepo } from "./analyze/index.js";
import { terminalPreview, projectionArtifacts } from "./project/index.js";

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
  writeFileSync(file, JSON.stringify(model, null, 2) + "\n", "utf8");

  console.log(`✓ Initialized Archmantic model for "${project}"`);
  console.log(`  → ${MODEL_DIR}/${MODEL_FILE}`);
  console.log(`  Next: \`archmantic analyze\` to reverse-engineer the model (coming in M1).`);
  return 0;
}

function cmdAnalyze(): number {
  const root = process.cwd();
  const model = { ...analyzeRepo(root), generatedAt: new Date().toISOString() };

  const dir = join(root, MODEL_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, MODEL_FILE), JSON.stringify(model, null, 2) + "\n", "utf8");

  const externalSystems = model.systems.filter((s) => s.kind === "external").length;
  const internalDeps = model.relations.filter((r) => r.to.startsWith("comp:")).length;
  const externalDeps = model.relations.filter((r) => r.to.startsWith("sys:ext:")).length;

  console.log(`✓ Analyzed "${model.project}" (Tier 0 + Tier 1 + structural derivation)`);
  console.log(`  components:    ${model.components.length}`);
  console.log(`  dependencies:  ${internalDeps} internal, ${externalDeps} external`);
  console.log(`  external systems: ${externalSystems}`);
  console.log(`  capabilities:  ${model.capabilities.length}`);
  console.log(`  processes:     ${model.processes.length}, flows: ${model.flows.length}`);
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
  analyze        Reverse-engineer the architecture model from this repo   [M1]
  mcp            Start the MCP server exposing the model to AI agents      [M5]
  view           Capability map + diagrams + trust report (writes view.html)

Options:
  -v, --version  Print version
  -h, --help     Show this help`);
}

function main(argv: string[]): number {
  const [command, ...rest] = argv;

  if (command === "-v" || command === "--version") {
    console.log(pkg.version);
    return 0;
  }
  if (!command || command === "-h" || command === "--help" || command === "help") {
    printHelp();
    return 0;
  }

  switch (command) {
    case "init":
      return cmdInit(rest);
    case "analyze":
      return cmdAnalyze();
    case "mcp":
      return notImplemented("mcp", "M5 (MCP server + token-savings proof)");
    case "view":
      return cmdView();
    default:
      console.error(`Unknown command: ${command}\n`);
      printHelp();
      return 1;
  }
}

process.exit(main(process.argv.slice(2)));
