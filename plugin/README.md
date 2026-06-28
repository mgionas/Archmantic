# Archmantic — Claude Code plugin

Makes your agent **query a grounded architecture model of your codebase over MCP**
instead of reading whole files — ~98% fewer tokens, answers grounded to `file:line`.

What it bundles:
- **MCP server**, auto-registered (no manual `claude mcp add`) — runs `npx archmantic@latest mcp` in your project.
- **A skill** (`use-archmantic`) whose triggers make Claude reach for the model on its own when onboarding to / exploring / reasoning about a repo.
- **`/architecture`** command for an on-demand, grounded overview.

## Install

```bash
/plugin marketplace add mgionas/Archmantic
/plugin install archmantic@archmantic
```

Then, in any repo you want it to work on, generate the model once:

```bash
npx archmantic@latest analyze     # writes .archmantic/model.json (commit it)
```

The skill auto-runs `analyze` guidance if the model is missing.

## Recommended: skip the per-tool prompt

Plugins can't set permissions, so add this one rule to your `~/.claude/settings.json`
(or a project `.claude/settings.json`) so MCP calls don't prompt every time:

```json
{ "permissions": { "allow": ["mcp__archmantic__*"] } }
```

Reads-only variant (keeps the write tools `refresh`/`sync`/`sync_features`/`curate` gated):

```json
{ "permissions": { "allow": [
  "mcp__archmantic__get_context", "mcp__archmantic__get_architecture_map",
  "mcp__archmantic__get_component", "mcp__archmantic__list_components",
  "mcp__archmantic__search_capabilities", "mcp__archmantic__whats_related",
  "mcp__archmantic__get_data_model", "mcp__archmantic__get_api_surface",
  "mcp__archmantic__get_feature", "mcp__archmantic__list_features",
  "mcp__archmantic__get_process", "mcp__archmantic__get_sequence",
  "mcp__archmantic__get_project", "mcp__archmantic__suggest_skills",
  "mcp__archmantic__list_skills", "mcp__archmantic__get_skill"
] } }
```

See the main [README](../README.md) for the full CLI + MCP reference.
