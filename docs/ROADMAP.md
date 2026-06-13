# Archmantic — Roadmap

> Living priority map. Owner-decided sequence, with rationale so future-us
> remembers *why*. Pairs with [STRATEGY.md](./STRATEGY.md) (positioning) and
> [ARCHITECTURE.md](./ARCHITECTURE.md) (the model-first design).

## North star

A living, **provenance-grounded** architecture model that serves humans (visual
diagrams) and AI agents (via MCP). We differentiate on **architecture + BPMN +
human-and-agent + edit-then-build**, *not* on code-graph depth (that's the red
ocean — Sourcegraph, LSP, IDE indexers already own function-level navigation).
Every roadmap item is judged against: does it make the model more *trustworthy*,
more *useful to agents*, or more *adoptable* — without dragging us into
code-graph commodity territory?

## Priority map

| Tier | Item | Why now | Impact · Effort |
|---|---|---|---|
| **NOW** | npm publish (core) | Unblocks the whole funnel — landing already promises `npx archmantic` | High · Low |
| **NOW** | In-app `/docs` | Required the instant npm is live | High · Low |
| **NEXT** | Data model → ERD | Best differentiated IR extension; agents need the schema | High · Med |
| **NEXT** | GitHub Action / PR diff | Makes the shipped "drift & PR diffs" USP real; retention | High · Med |
| **NEXT** | MCP usage stats | Proof-of-value loop + metering substrate for billing | High · Med |
| **LATER** | API surface (routes) | Completes the "what's the contract" layer | Med · Med |
| **LATER** | Multi-repo auto-link | Novel cross-repo gap detection; smarter after ERD/API | High · Med-High |
| **DEFER** | Function-level tracking | Red-ocean; dilutes positioning. Drill-down only, if ever | Low · High |

Recommended sequence: **npm + docs** (coupled, cheap) → **ERD** → **GitHub
Action** → **MCP usage stats** → API surface → multi-repo auto-link.

---

## Decisions (locked)

- **D1 — One npm package.** Publish only the Apache-2.0 core (`dist/`: CLI +
  library — analyze/ir/mcp/project/diff/cloud/agent). The `web/` app is the AGPL
  cloud and stays unpublished / self-hosted. Name `archmantic` (confirmed free on
  npm). First version `0.1.0`. The actual `npm publish` is owner-gated (outward,
  irreversible).
- **D2 — Docs live in-app** at `/docs` (MDX, shares the design system, one
  deploy). A standalone docs site (Nextra/Mintlify) is a later option, not now.
- **D3 — Data model first cut = ERD from ORM/migrations** (Prisma, Drizzle,
  TypeORM, raw SQL migrations). New `DataEntity` IR element + ERD projection.
  Groundable with high confidence → keeps the provenance invariant.
- **D4 — Function-level tracking is deferred.** Architecture-level only. If ever,
  expose as a drill-down — never lead with it.
- **D5 — Multi-repo auto-link starts heuristic** (match a repo's detected
  external systems against other repos' names/packages/API bases), agent/MCP
  `suggest_links` tool added once the IR is richer (post-ERD/API).
- **D6 — MCP usage stats = user-facing dashboard first**, billing/metering reuse
  second (same event stream).

---

## Item detail

### NOW · npm publish (core)
Drop `private`, add `repository`/`keywords`/`homepage`/`bugs`, an npm-facing
README, verify `files: ["dist"]` + `prepublishOnly: build`. Smoke-test with
`npm pack` and a global install of the tarball. Hold `npm publish` for owner go.

### NOW · In-app `/docs`
Sections: About, Install, Quickstart (`analyze → push`), CLI reference, MCP
setup, Cloud/teams, Multi-repo (`.archmantic/config.json`), Edit-then-build.
MDX in the Next.js app; linked from the landing nav.

### NEXT · Data model → ERD
- IR: `DataEntity { fields, relations }` with provenance to schema file lines.
- Detect: `schema.prisma`, Drizzle table defs, TypeORM entities, SQL migrations.
- Project: Mermaid `erDiagram`. New "Data" tab in the project view + MCP query.

### NEXT · GitHub Action / PR diff
Reuse `diff/model-diff` + drift. Action runs `analyze`, compares against the
base-branch model, comments the **architecture** delta (new components/relations/
capabilities/entities) on the PR — not a line diff.

### NEXT · MCP usage stats
MCP server logs each tool call (tool, tokens in/out, project, est. tokens-saved
vs raw file read — reuse `mcp/bench`). Pushed to cloud → web `/usage` dashboard:
"your agents made N queries, ~X% fewer tokens." Same event stream later feeds
metered-AI billing.

### LATER · API surface (routes)
Detect REST/tRPC/GraphQL endpoints → `Endpoint` IR element. The contract layer
both architects and agents ask for first; pairs naturally with ERD.

### LATER · Multi-repo auto-link
Surface three states in `/systems`: **connected** (declared + confirmed),
**inferred** (we think these link — confirm?), **dangling** (calls an external
matching no known repo → a real gap). Heuristic → then agent/MCP assisted.

### DEFER · Function-level tracking
Red-ocean. Revisit only as an optional drill-down if a concrete user need
appears that architecture-level elements can't serve.
