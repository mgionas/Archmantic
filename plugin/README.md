# Archmantic — Claude Code plugin

Makes your agent **query a grounded architecture model of your codebase over MCP**
instead of reading whole files — ~98% fewer tokens, answers grounded to `file:line`.

What it bundles:
- **MCP server**, auto-registered (no manual `claude mcp add`) — runs `npx archmantic@latest mcp` in your project.
- **A skill** (`use-archmantic`) whose triggers make Claude reach for the model on its own when onboarding to / exploring / reasoning about a repo.
- **`/architecture`** command for an on-demand, grounded overview.
- **A PreToolUse hook** (main agent) that, *once per session* in a repo that has a model, nudges it to query Archmantic before reading/grepping many files — non-blocking and silent when there's no model.
- **A SubagentStart hook** that nudges *every* subagent (parallel fan-outs, other plugins' workflows, Explore/Plan) to query the model first — PreToolUse hooks don't fire inside subagents, so this is how multi-agent runs get the token savings too.
- **An `archmantic-explorer` subagent** — read-only, queries the model first. Delegate codebase-understanding/research here when you want to be explicit.

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
{ "permissions": { "allow": ["mcp__plugin_archmantic_archmantic__*"] } }
```

(Plugin MCP tools are namespaced `mcp__plugin_<plugin>_<server>__*`. If you wired the
server manually instead of via the plugin, use `mcp__archmantic__*`.)

## Recommended: report usage to the cloud dashboard once, globally

So usage from every project (not just ones with a per-repo `.env.local`) shows on the
web `/usage` dashboard, set your token once in **`~/.archmantic/.env`**:

```
ARCHMANTIC_TOKEN=your-org-token
ARCHMANTIC_API_URL=https://<your-archmantic-deployment>
```

The MCP server picks these up as a fallback (project `.env.local` still wins).

Reads-only variant (keeps the write tools `refresh`/`sync`/`sync_features`/`curate` gated):

```json
{ "permissions": { "allow": [
  "mcp__plugin_archmantic_archmantic__get_context", "mcp__plugin_archmantic_archmantic__get_architecture_map",
  "mcp__plugin_archmantic_archmantic__get_component", "mcp__plugin_archmantic_archmantic__list_components",
  "mcp__plugin_archmantic_archmantic__search_capabilities", "mcp__plugin_archmantic_archmantic__whats_related",
  "mcp__plugin_archmantic_archmantic__get_data_model", "mcp__plugin_archmantic_archmantic__get_api_surface",
  "mcp__plugin_archmantic_archmantic__get_feature", "mcp__plugin_archmantic_archmantic__list_features",
  "mcp__plugin_archmantic_archmantic__get_process", "mcp__plugin_archmantic_archmantic__get_sequence",
  "mcp__plugin_archmantic_archmantic__get_project", "mcp__plugin_archmantic_archmantic__suggest_skills",
  "mcp__plugin_archmantic_archmantic__list_skills", "mcp__plugin_archmantic_archmantic__get_skill",
  "mcp__plugin_archmantic_archmantic__suggest_links"
] } }
```

See the main [README](../README.md) for the full CLI + MCP reference.
