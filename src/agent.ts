/**
 * Agent hand-off — the "build" of edit-then-build. Runs the Archmantic build
 * spec through Claude (Opus 4.8, BYOK) to produce a concrete implementation plan
 * a coding agent (e.g. Claude Code) can execute to realize the architecture.
 *
 * Read-only: it produces a plan, it does not edit the repo. Gated on an
 * Anthropic credential (API key or `ant auth login`), like the Tier-2 pass.
 */
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, relative, resolve, sep } from "node:path";
import { hasAnthropicCredentials, NO_CREDENTIAL_HINT } from "./auth.js";

const OPUS = "claude-opus-4-8";
/** USD per 1M tokens [input, output] for Opus 4.8. */
const PRICING: [number, number] = [5.0, 25.0];

export interface HandoffResult {
  ran: boolean;
  reason?: string;
  plan?: string;
  inputTokens: number;
  outputTokens: number;
  estCostUsd: number;
}

const SYSTEM = `You are a senior software engineer receiving an Archmantic "build spec" — the intended architecture of a repository, derived from its code and grounded in file:line references (capabilities, components with responsibilities and dependencies, external systems, and a business process).

Produce a concrete, ordered implementation plan that a coding agent can execute to make the codebase realize this architecture. For each step: name the specific files/components to add or change, the dependencies involved, and why. Call out likely gaps between the spec and the current code, and a final verification step. Be actionable and concise. Output Markdown only — no preamble.`;

export async function runHandoff(specMarkdown: string, project: string): Promise<HandoffResult> {
  if (!hasAnthropicCredentials()) {
    return { ran: false, reason: `${NO_CREDENTIAL_HINT} (agent hand-off skipped)`, inputTokens: 0, outputTokens: 0, estCostUsd: 0 };
  }
  const client = new Anthropic();
  try {
    const resp = await client.messages.create({
      model: OPUS,
      max_tokens: 8192,
      system: SYSTEM,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: `Build spec for "${project}":\n\n${specMarkdown}` }],
    } as never);
    const plan = (resp.content as Anthropic.ContentBlock[])
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const u = resp.usage;
    return {
      ran: true,
      plan,
      inputTokens: u.input_tokens,
      outputTokens: u.output_tokens,
      estCostUsd: (u.input_tokens * PRICING[0] + u.output_tokens * PRICING[1]) / 1_000_000,
    };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { ran: false, reason: `Anthropic authentication failed — ${NO_CREDENTIAL_HINT}`, inputTokens: 0, outputTokens: 0, estCostUsd: 0 };
    }
    throw err;
  }
}

// ── Autonomous build: a tool-use agent loop that edits the repo ───────────────

const MAX_TURNS = 40;
const MAX_VERIFY_ROUNDS = 3;
const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", ".next", ".archmantic", "out-tsc", ".vercel"]);

export interface BuildResult extends HandoffResult {
  filesChanged: string[];
  turns: number;
  summary?: string;
  checkPassed?: boolean;
  checkOutput?: string;
}

/** Run the project's verification command (build/tests) and capture its output. */
function runCheck(root: string, cmd: string): { ok: boolean; output: string } {
  try {
    const out = execSync(`${cmd} 2>&1`, { cwd: root, encoding: "utf8", timeout: 300_000, maxBuffer: 10 * 1024 * 1024 });
    return { ok: true, output: out.slice(-4000) };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, output: `${e.stdout ?? ""}${e.stderr ?? ""}${e.message ?? ""}`.slice(-4000) };
  }
}

/** Resolve a model-provided path inside the repo; reject escapes and heavy dirs. */
function safePath(root: string, p: string): string | null {
  const abs = resolve(root, p);
  const base = resolve(root);
  if (abs !== base && !abs.startsWith(base + sep)) return null; // outside the repo
  const rel = relative(base, abs);
  if (rel.split(sep).some((seg) => IGNORE_DIRS.has(seg))) return null;
  return abs;
}

function listFiles(root: string, dir: string): string {
  const start = safePath(root, dir || ".");
  if (!start) return "error: path outside repo";
  const out: string[] = [];
  const stack = [start];
  const baseAbs = resolve(root);
  while (stack.length && out.length < 600) {
    const cur = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const abs = join(cur, e.name);
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(e.name) || e.name.startsWith(".")) continue;
        stack.push(abs);
      } else {
        out.push(relative(baseAbs, abs).split("\\").join("/"));
      }
    }
  }
  return out.sort().join("\n") || "(empty)";
}

const TOOLS = [
  { name: "list_files", description: "List repository files (relative paths).", input_schema: { type: "object", properties: { dir: { type: "string", description: "optional subdirectory" } } } },
  { name: "read_file", description: "Read a file's contents.", input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  { name: "write_file", description: "Create or overwrite a file with the given content.", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "run_check", description: "Run the project's verification (build + tests) and return the output. Use this after changes and fix any failures.", input_schema: { type: "object", properties: {} } },
];

const BUILD_SYSTEM = `You are a careful coding agent operating inside a repository. You are given an Archmantic build plan/spec. Use the tools to read existing files and make the MINIMAL, correct changes needed to realize the plan. Prefer editing existing files over adding new ones. Do not touch generated/vendor files.

After making changes, call run_check to build and test the project. If it fails, read the output, fix the problem, and run_check again — repeat until it passes. When the work is complete and run_check passes (or there is nothing to change), stop calling tools and reply with a short summary of what you changed and why.`;

function runTool(
  root: string,
  name: string,
  input: Record<string, unknown>,
  changed: Set<string>,
  checkCommand: string,
): { text: string; isError?: boolean } {
  try {
    if (name === "list_files") return { text: listFiles(root, String(input.dir ?? "")) };
    if (name === "run_check") {
      process.stderr.write(`  ⚙ run_check: ${checkCommand}\n`);
      const { ok, output } = runCheck(root, checkCommand);
      return { text: `exit ${ok ? 0 : 1}\n${output}` };
    }
    if (name === "read_file") {
      const abs = safePath(root, String(input.path));
      if (!abs) return { text: "error: path outside repo", isError: true };
      if (!existsSync(abs)) return { text: "error: file not found", isError: true };
      return { text: readFileSync(abs, "utf8") };
    }
    if (name === "write_file") {
      const rel = String(input.path);
      const abs = safePath(root, rel);
      if (!abs) return { text: "error: path outside repo or in an ignored dir", isError: true };
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, String(input.content ?? ""), "utf8");
      changed.add(rel);
      process.stderr.write(`  ✎ wrote ${rel}\n`);
      return { text: `wrote ${rel}` };
    }
    return { text: `unknown tool ${name}`, isError: true };
  } catch (err) {
    return { text: `error: ${err instanceof Error ? err.message : String(err)}`, isError: true };
  }
}

/** Autonomous build: agent reads/writes files in `root` to execute the plan, then
 *  self-verifies via the check command, fixing failures until green (or a cap). */
export async function runAutonomousBuild(
  root: string,
  plan: string,
  project: string,
  checkCommand: string,
): Promise<BuildResult> {
  const base: BuildResult = { ran: false, filesChanged: [], turns: 0, inputTokens: 0, outputTokens: 0, estCostUsd: 0 };
  if (!hasAnthropicCredentials()) {
    return { ...base, reason: `${NO_CREDENTIAL_HINT} (autonomous build skipped)` };
  }
  const client = new Anthropic();
  const changed = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [
    { role: "user", content: `Implement this build plan in the repo "${project}". The verification command is: ${checkCommand}\n\n${plan}` },
  ];
  let summary = "";
  let inTok = 0;
  let outTok = 0;
  let turns = 0;
  let verifyRounds = 0;
  let check: { ok: boolean; output: string } = { ok: false, output: "" };

  try {
    for (; turns < MAX_TURNS; turns++) {
      const resp = await client.messages.create({
        model: OPUS,
        max_tokens: 16000,
        system: BUILD_SYSTEM,
        thinking: { type: "adaptive" },
        tools: TOOLS,
        messages,
      } as never);
      inTok += resp.usage.input_tokens;
      outTok += resp.usage.output_tokens;
      messages.push({ role: "assistant", content: resp.content });

      const toolUses = (resp.content as Anthropic.ContentBlock[]).filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      if (resp.stop_reason !== "tool_use" || toolUses.length === 0) {
        summary = (resp.content as Anthropic.ContentBlock[])
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        // Guarantee: verify on stop. If it changed files and the check fails,
        // hand the failure back and let it fix — up to MAX_VERIFY_ROUNDS.
        if (changed.size === 0) break;
        check = runCheck(root, checkCommand);
        process.stderr.write(`  ⚙ verify (${checkCommand}): ${check.ok ? "passed" : "FAILED"}\n`);
        if (check.ok || verifyRounds >= MAX_VERIFY_ROUNDS) break;
        verifyRounds++;
        messages.push({
          role: "user",
          content: `The verification command \`${checkCommand}\` failed. Fix the issues and run_check again until it passes.\n\n${check.output}`,
        });
        continue;
      }

      const results = toolUses.map((tu) => {
        const r = runTool(root, tu.name, tu.input as Record<string, unknown>, changed, checkCommand);
        return { type: "tool_result" as const, tool_use_id: tu.id, content: r.text, is_error: r.isError };
      });
      messages.push({ role: "user", content: results });
    }
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { ...base, reason: `Anthropic authentication failed — ${NO_CREDENTIAL_HINT}` };
    }
    throw err;
  }

  return {
    ran: true,
    filesChanged: [...changed],
    turns,
    summary,
    checkPassed: changed.size === 0 ? undefined : check.ok,
    checkOutput: check.output ? check.output.slice(-1500) : undefined,
    inputTokens: inTok,
    outputTokens: outTok,
    estCostUsd: (inTok * PRICING[0] + outTok * PRICING[1]) / 1_000_000,
  };
}
