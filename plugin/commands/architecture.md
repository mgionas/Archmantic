---
description: Summarize this repository's architecture using the Archmantic model — context, domains, data model, and API surface, grounded in code.
---

Produce a grounded architecture overview of the **current repository** using the
Archmantic MCP tools (do not read source files to reconstruct this — query the model):

1. `mcp__archmantic__get_context` — project, systems, external dependencies, primary process.
2. `mcp__archmantic__get_architecture_map` — domains and how they connect.
3. `mcp__archmantic__get_data_model` and `mcp__archmantic__get_api_surface` — if present.

Then write a concise summary for a developer new to the repo:
- **What it is** and how it's shaped (domains / layers).
- **Key external systems** it depends on.
- **Data model** and **API surface** highlights, if any.
- Anything **low-confidence or flagged** that's worth a closer look.

Cite the `file:line` references the tools return. If a tool reports no model exists,
tell the user to run `npx archmantic@latest analyze` first, then retry.
