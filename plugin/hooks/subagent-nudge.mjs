#!/usr/bin/env node
/**
 * SubagentStart nudge: fires for EVERY subagent that starts (parallel fan-outs,
 * other plugins' workflows, Explore/Plan, custom agents). If the repo has an
 * Archmantic model, inject guidance so the subagent queries the model before
 * reading files — this is the only mechanism that reaches arbitrary subagents
 * (PreToolUse hooks don't fire inside them). It's a nudge, not enforcement.
 *
 * Skips when there's no model, and skips Archmantic's own agents (they already
 * query the model). Any error → exit 0 silently; never disrupt a subagent.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(""));
  });
}

try {
  const raw = await readStdin();
  const input = raw ? JSON.parse(raw) : {};
  const cwd = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const agentType = String(input.agent_type || "");

  // Only when this repo has a model worth querying.
  if (!existsSync(join(cwd, ".archmantic", "model.json"))) process.exit(0);
  // Don't nag Archmantic's own agents — they already query the model.
  if (/archmantic/i.test(agentType)) process.exit(0);

  const additionalContext =
    "[Archmantic] This repo has a grounded architecture model. Before reading or grepping " +
    "files to build context, query the Archmantic MCP tools first — `get_context` and " +
    "`get_architecture_map` for the shape, then `whats_related` / `search_capabilities` / " +
    "`list_components` / `get_data_model` / `get_api_surface` for specifics. They return " +
    "grounded (file:line) answers for far fewer tokens. Read specific files only to confirm a detail.";

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "SubagentStart", additionalContext },
    }),
  );
  process.exit(0);
} catch {
  process.exit(0);
}
