---
name: use-archmantic
description: >-
  Use when onboarding to, exploring, or answering questions about a codebase —
  BEFORE reading or grepping many files to build context. Triggers: "how does X
  work", "where is Y", "what depends on Z / what does Z affect", "what's the data
  model / API surface / architecture / main flow", "what does this project do",
  understanding an unfamiliar repo, or planning a change that spans modules. Query
  the Archmantic architecture model over its MCP tools instead of reading whole
  files — answers are grounded to file:line and cost ~98% fewer tokens. Skip only
  for trivial single-file edits where you already know the exact file.
---

# Use Archmantic before reading the codebase

Archmantic exposes a **grounded architecture model** of the current repo over MCP. It
is almost always faster and cheaper to ask the model than to read/grep files — and the
answers carry `file:line` provenance you can cite and verify.

## Default behavior

When you need to understand *anything structural* about this repo, reach for the
`mcp__archmantic__*` tools **first**, then read specific files only to confirm a detail.

If a tool errors with "no model", the repo hasn't been analyzed yet — run
`npx archmantic@latest analyze` (writes `.archmantic/model.json`), then retry.

## Which tool for which question

| You need… | Call |
|---|---|
| "What is this project / how is it shaped?" | `get_context`, then `get_architecture_map` (domains + cross-domain deps + external systems) |
| The human-authored intent (goal, owners, agents) | `get_project` |
| "What can it do?" (capabilities) | `search_capabilities` (empty query = all) |
| A specific module's role, deps, dependents | `get_component` ; browse with `list_components` |
| "What depends on / is affected by X" | `whats_related` |
| Data model / tables / relations (ERD) | `get_data_model` |
| API endpoints (REST/tRPC/GraphQL) | `get_api_surface` |
| A user-facing feature + its components/flow | `get_feature` ; browse with `list_features` |
| The main process / a sequence | `get_process`, `get_sequence` |
| The right playbook for this repo | `suggest_skills`, then `get_skill` |

## A good onboarding sweep

1. `get_context` — the one-paragraph shape: systems, externals, counts, primary process.
2. `get_architecture_map` — domains and how they connect (the L1/L2 view).
3. Then drill: `get_component` / `whats_related` for the area you're working in;
   `get_data_model` / `get_api_surface` when touching persistence or endpoints.

## Writing back (optional)

After you change the architecture, call `refresh` (re-analyze) or `sync` so the model
stays current; `curate` lets you name/describe domains + write the positioning narrative
for humans. These are writes — only call them when you've actually changed structure.

## Delegating to subagents / parallel workflows

Subagents **inherit the `mcp__archmantic__*` tools** — but the PreToolUse nudge does *not*
fire inside them, so they won't think to use the model unless told. When you spawn subagents
(Task tool, parallel workflows, Explore) to understand or research this codebase:

- **Say so in the delegation prompt** — e.g. *"This repo has an Archmantic model; use
  `mcp__archmantic__get_context` / `get_architecture_map` / `whats_related` / `search_capabilities`
  before reading files."* — so each subagent optimizes tokens too, not just you.
- Or **delegate codebase-understanding to the `archmantic-explorer` subagent**, which is built to
  query the model first and read files only as fallback.

This matters most for multi-agent runs: the subagents are usually the heavy file-readers, so
that's where the token savings are largest.

## Why prefer this

The whole point: get the *exact architectural slice* you need in a few hundred tokens,
grounded in code, instead of reading whole files to reconstruct it. Use it liberally.
