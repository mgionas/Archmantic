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
| ✅ done | npm publish (core) | Published `@archmantic/cli@0.1.0` (public) | High · Low |
| ✅ done | In-app `/docs` | Shipped, public, linked from header + landing | High · Low |
| ✅ done | Data model → ERD | Prisma + Drizzle + SQL → `DataEntity` IR + Mermaid ERD; CLI + web Data tab + MCP `get_data_model` | High · Med |
| ✅ done | GitHub Action / PR diff | Reusable `action.yml` + sticky PR comment via `archmantic diff`; self CI dogfoods it | High · Med |
| ✅ done | MCP usage stats | Per-tool-call recording + token savings; CLI `usage` + web `/usage` dashboard; metering substrate | High · Med |
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

### ✅ done · Data model → ERD
- IR: `DataEntity { fields, relations }` with provenance to schema file lines.
- Detect: `schema.prisma` ✅, Drizzle table defs ✅, SQL `CREATE TABLE` migrations ✅.
  TypeORM entities — still TODO.
- Project: Mermaid `erDiagram` ✅. "Data" tab in the project view ✅ + MCP `get_data_model` ✅.
- Cardinality inferred from FK direction so FK-only sources (Drizzle/SQL) render correctly.

### ✅ done · GitHub Action / PR diff
Reusable composite `action.yml` (`uses: mgionas/Archmantic@…`) runs
`archmantic diff origin/<base>` and posts a **sticky** PR comment with the
architecture delta (components/capabilities/data-model/externals) — not a line
diff. Self-hosted CI (`.github/workflows/`) dogfoods it against this repo's own
PRs (source build) plus a build+test job.

### ✅ done · MCP usage stats
MCP server records each read tool call (tool, project, est. tokens-out + tokens
saved vs raw file reads). Events append to a durable local log
(`.archmantic/usage.jsonl`) and best-effort batch-flush to the cloud (API token →
direct DB → local-only). `archmantic usage [--sync]` summarizes locally and
re-pushes; web `/usage` aggregates totals, per-tool, per-project, and a 14-day
activity chart. Idempotent by event UUID; the same event stream is the metering
substrate for future billing.

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
