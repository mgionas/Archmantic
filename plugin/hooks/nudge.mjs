#!/usr/bin/env node
/**
 * PreToolUse nudge (Read/Grep/Glob): if the current repo has an Archmantic model,
 * remind the agent — ONCE per session — to query the model instead of reading many
 * files. Non-blocking: it always lets the tool proceed (permissionDecision "allow")
 * and surfaces the hint via `additionalContext`, which the model reads as guidance.
 *
 * Written in Node (no jq dependency). Any error → exit 0 silently; the hook must
 * never break the agent's tool call.
 */
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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

  // Only nudge when this repo actually has a model worth querying.
  if (!existsSync(join(cwd, ".archmantic", "model.json"))) process.exit(0);

  // Fire at most once per session — don't nag on every file read.
  const session = String(input.session_id || "nosession").replace(/[^A-Za-z0-9_-]/g, "");
  const marker = join(tmpdir(), `archmantic-nudge-${session}`);
  if (existsSync(marker)) process.exit(0);
  try {
    writeFileSync(marker, "1");
  } catch {
    /* tmp not writable — still nudge this once */
  }

  const additionalContext =
    "This repo has an Archmantic architecture model (.archmantic/model.json). Before reading or " +
    "grepping many files to build context, prefer the Archmantic MCP tools: " +
    "`get_context` and `get_architecture_map` for the overall shape, then " +
    "list_components / whats_related / search_capabilities / get_data_model / get_api_surface for specifics. " +
    "They return grounded (file:line) answers in far fewer tokens. Reading a specific file to confirm a detail is still fine.";

  // No permissionDecision: the nudge must not auto-approve the tool call it fires
  // on (that would bypass the permission prompt) — inject guidance only and let the
  // normal permission flow decide.
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext,
      },
    }),
  );
  process.exit(0);
} catch {
  process.exit(0);
}
