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
| ✅ done | npm publish (core) | Published `archmantic@0.1.0` (public) | High · Low |
| ✅ done | In-app `/docs` | Shipped, public, linked from header + landing | High · Low |
| ✅ done | Data model → ERD | Prisma + Drizzle + SQL → `DataEntity` IR + Mermaid ERD; CLI + web Data tab + MCP `get_data_model` | High · Med |
| ✅ done | GitHub Action / PR diff | Reusable `action.yml` + sticky PR comment via `archmantic diff`; self CI dogfoods it | High · Med |
| ✅ done | MCP usage stats | Per-tool-call recording + token savings; CLI `usage` + web `/usage` dashboard; metering substrate | High · Med |
| ✅ done | API surface (routes) | REST/tRPC/GraphQL → `Endpoint` IR; CLI/HTML/spec + web API tab + MCP `get_api_surface` | Med · Med |
| ✅ done | Multi-repo auto-link | `analyzeLinks` → connected/inferred/dangling; web `/systems` panel + CLI `system` | High · Med-High |
| ✅ done | Agent knowledge file | `AGENTS.md` projection in a managed block; auto on analyze/update + MCP refresh/sync; reaches non-MCP agents | High · Low |
| ✅ done | Internal-pages redesign | full-bleed shell + icon rail + facet column + interactive diagram canvas (P0–P3); see docs/design/REDESIGN.md | High · High |
| ✅ done | Interactive graphs | React Flow for Context/Components/ERD: grouping, role colors, click-through cross-facet panels | High · High |
| **DEFER** | Function-level tracking | Red-ocean; dilutes positioning. Drill-down only, if ever | Low · High |

## Next — v1.2: interactivity & accuracy

Builds on the React Flow graphs + semantic roles. Web-only items deploy via Vercel;
core items ship in a new npm release.

| # | Item | Scope | Status |
|---|---|---|---|
| **1** | Deep-linkable view state | web | ✅ `?view=<facet>&d=<diagram>` via `useUrlState` |
| **2** | Content-signal role refinement | core | ✅ `refineRole` content signals (route/hook/store/ui); **pending npm 1.2.0 publish** |
| **3** | Graph polish | web | ✅ clickable role legend (highlight/dim) |

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

### ✅ done · API surface (routes)
`Endpoint` IR element from REST (Next.js App Router + Pages API, Express/Fastify/
Koa/Hono calls), tRPC procedures, and GraphQL SDL (files + inline `gql`). Leading-
slash guard avoids `.get()` false positives. Surfaced in terminal/HTML/build-spec,
the web **API** tab, and MCP `get_api_surface`. TypeORM data-model source remains
the only open detector item.

### ✅ done · Multi-repo auto-link
`analyzeLinks(models)` classifies cross-repo links across an org: **connected**
(declared `consumes` resolving to a present repo), **inferred** (an imported
external fuzzy-matches a sibling repo but isn't declared — confirm by adding to
`consumes`), **dangling** (declared `consumes` with no matching repo → a real
gap). Fuzzy match drops npm scopes/separators/common suffixes, guarded against
short/ambiguous keys. Surfaced in the web `/systems` panel and CLI `system`
output. ✅ MCP `suggest_links` tool (1.3.0): pulls the org's models (token/DB),
runs `analyzeLinks`, and returns this repo's inferred/dangling links for an agent
to apply to `.archmantic/config.json`.

### ✅ done · Monorepo / nested projects (1.4.0)
The structural walkers (`walkSourceFiles`, `findFiles`) skip nested packages so an
independent sibling app (e.g. our own `web/`) doesn't bleed into the model. That
same rule was silently dropping a monorepo's real packages — their API surface,
components, and data model vanished (the "empty API" report). Fix: descend into a
nested package **only when it's a workspace member**. Detection is fully dynamic —
declared npm/yarn `workspaces` + `pnpm-workspace.yaml`, with a **convention
fallback** (`apps/*`, `packages/*`, `services/*`, `libs/*`, …) so undeclared
monorepos (Turborepo/Nx) still analyze as one model. Each element is tagged with
its owning `package`; `model.workspaces` lists members. One model per repo (matches
the per-commit history spine); the multi-repo `system` view still covers genuinely
separate repos. Surfaced as a **package** grouping in the web Components + API
facets and an Overview "Monorepo · N packages" card, package-grouped MCP
`get_api_surface`, a `get_context` monorepo line, and a Monorepo line in
AGENTS.md. Tech-stack detection now aggregates deps across members. The chosen
approach was Option A (one grouped model) over Option B (system of sub-projects).

### ✅ done · NestJS API detection (1.5.0)
`apps/api` NestJS services reported an empty API surface because the detector only
understood Next.js / Express / Fastify / Koa / Hono / tRPC / GraphQL — not NestJS
decorators. Added `@Controller('base')` + method decorators (`@Get`/`@Post`/`@Put`/
`@Patch`/`@Delete`/`@Options`/`@Head`/`@All`), joining the controller prefix with
each method path (`@Controller('insights')` + `@Get(':id')` → `GET /insights/:id`;
empty `@Controller()` → root). Verified on DrivePulse-Core: 0 → 31 endpoints across
12 controllers, package-tagged to `apps/api`. (`packages/contracts/openapi.json`
was empty, so OpenAPI ingestion stays deferred until a populated spec appears.)

### ✅ done · Laravel / PHP API + stack (1.6.0)
PHP/Inertia repos analyzed only the JS frontend, so the API surface read empty
(or showed a handful of JS client calls). Added a Laravel route detector
(`src/analyze/laravel.ts`): parses `routes/*.php` for `Route::verb('path')`,
nested prefix groups (`Route::prefix('x')->group` and
`Route::group(['prefix'=>'x'], …)`), `Route::match([...])`, and
`resource`/`apiResource` expansion; `routes/api.php` is served under `/api`;
`{id}`/`{id?}` → `:id`. Grounded to file:line, merged + de-duped with the JS
endpoints. Stack detection now also reads `composer.json`
(Laravel/Symfony/Inertia/Livewire/Sanctum/PHP/…). Verified: **fantasy 0 → 201**,
**sh-purchasing 12 → 217** endpoints. Walker ignore-list centralized
(`src/analyze/ignore.ts`) and extended with PHP/Laravel defaults
(`vendor/`, `storage/`, `bootstrap/`, `tmp/`) so Composer's `vendor/` can't flood
the API surface. Also fixed: a `pnpm-workspace.yaml` listing `.` (root) no longer
mislabels a single-package repo as a monorepo. OpenAPI ingestion + PHP-as-
components remain deferred.

### ✅ done · Laravel pages + data model (1.7.0)
Laravel repos showed no DB and (for Vue/Inertia) no pages. Added three things:
- **Vue SFC support** — `.vue` is now walked; tier1 extracts the `<script>` block so
  Inertia page/component import edges resolve. (fantasy: 0 → 111 .vue components.)
- **Migrations → data model** (`src/analyze/laravel-db.ts`) — parses
  `database/migrations/*.php` `Schema::create/table` blocks into entities/fields
  (PK/unique/optional, timestamps/softDeletes/morphs) with FK relations
  (`foreignId('x')->constrained()`, `foreign('x')->references->on`). Framework
  scaffolding tables (cache/jobs/sessions/…) are excluded. (fantasy: 0 → 47 domain
  entities, 59 relations.)
- **Blade + Livewire components** (`src/analyze/laravel-views.ts`) — `resources/views/
  **/*.blade.php` and `app/(Http/)Livewire/**` become components with view/layout/ui
  roles, so non-Inertia (blade/livewire) apps are covered too.
- Role classifier learns Laravel/Inertia paths (`resources/js/{Pages,Layouts,
  Components}`, `.blade.php`); new `view` role + color; labels strip `.vue`/`.blade.php`.
DB-from-`.env` connector deferred (needs a live DB = runtime tier). Custom
route-file prefixes still deferred.

### ✅ done · Spec layer Phase 1 — project brain (1.8.0)
Human-authored intent on top of the reverse-engineered structure (see
docs/design/SPEC-LAYER.md). A committed `.archmantic/project.json` manifest (goal,
status, author/owners, links, history) merged into `model.manifest`; the **agent
team auto-detects from `.claude/agents/*`**. Surfaced everywhere: MCP `get_project`
(+ goal in `get_context`), it leads the knowledge file (AGENTS.md + web), and the
web project Overview shows a "Project brain" card with author attribution. CLI
`project [--init]` scaffolds/prints it; `init` seeds it. Also locked: every MCP
read tool (incl. local/no-cred mode) is recorded to the usage log. Phases 2
(feature layer) and 3 (feature-scoped flows) next.

### DEFER · Function-level tracking
Red-ocean. Revisit only as an optional drill-down if a concrete user need
appears that architecture-level elements can't serve.
