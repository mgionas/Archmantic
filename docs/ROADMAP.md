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
| ✅ done | Data model → ERD | Prisma + Drizzle + SQL → `DataEntity` IR + React Flow ERD; CLI + web Data tab + MCP `get_data_model` | High · Med |
| ✅ done | GitHub Action / PR diff | Reusable `action.yml` + sticky PR comment via `archmantic diff`; self CI dogfoods it | High · Med |
| ✅ done | MCP usage stats | Per-tool-call recording + token savings; CLI `usage` + web `/usage` dashboard; metering substrate | High · Med |
| ✅ done | API surface (routes) | REST/tRPC/GraphQL → `Endpoint` IR; CLI/HTML/spec + web API tab + MCP `get_api_surface` | Med · Med |
| ✅ done | Multi-repo auto-link | `analyzeLinks` → connected/inferred/dangling; web `/systems` panel + CLI `system` | High · Med-High |
| ✅ done | Agent knowledge file | `AGENTS.md` projection in a managed block; auto on analyze/update + MCP refresh/sync; reaches non-MCP agents | High · Low |
| ✅ done | Internal-pages redesign | full-bleed shell + icon rail + facet column + interactive diagram canvas (P0–P3); see docs/design/REDESIGN.md | High · High |
| ✅ done | Interactive graphs | React Flow for Context/Components/ERD: grouping, role colors, click-through cross-facet panels | High · High |
| ✅ done | Real sequence diagrams | Dedicated React Flow sequence view: participant lifelines, activation bars, ordered labeled messages, self-message loops (web Sequence tab) | High · Med |
| ✅ done | Mermaid removed | Dropped Mermaid everywhere (web + CLI `.mmd` exports + HTML viewer); React Flow in the web, native HTML tables/lists in the CLI viewer | Med · Med |
| ✅ done | Skills (model-resolved) | On-shelf playbook catalog ranked against the grounded model with cited reasons; builtin + local + remote (`skill add`); MCP `suggest_skills`/`list_skills`/`get_skill` + CLI `skill` | High · Med |
| ✅ done | Experience layer (1.18.0) | Collect→curate→present: classify externals (libs≠systems) + Dependencies page; semantic Groups + **Architecture Map**; agent-driven **curation** (`get_architecture_map`/`curate` MCP + BYOK CLI `curate`/`publish --ai`); schema 0.2.0. See [design/EXPERIENCE-LAYER.md](./design/EXPERIENCE-LAYER.md) | Very High · High |
| ✅ done | Map polish (1.18.1) | Exact L2→L3 drill: Map opens Components filtered by domain `groupId` (not a name match) + group-by-domain + filter chip (INS-013); the "Misc" catch-all is de-emphasized and dropped from structural edges (INS-014); ships the deterministic AGENTS.md + sharpened `sync` from main | Med · Low |
| ✅ done | BPMN removed | Dropped `bpmn-js` + BPMN 2.0 entirely; the business process renders as a React Flow graph (Start → tasks → End) like every other view — one process renderer. Removed the editable BPMN canvas, the `apply` edit-then-build command, the `process.bpmn` artifact, and the HTML-viewer BPMN | Med · Low |
| ✅ done | Claude Code plugin (0.1 → 0.4) | Ship Archmantic as a plugin (`plugin/` + repo-as-marketplace): the **trigger skill** (`use-archmantic`), auto-registered MCP (pinned `@latest`), `/architecture` command, **PreToolUse nudge** (0.2), **subagent propagation** — skill delegation guidance + `archmantic-explorer` agent (0.3) + **SubagentStart hook** and correct `mcp__plugin_archmantic_archmantic__*` tool names (0.4). Fixes "agent ignores Archmantic once superpowers/other plugins are installed" (INS-022/024). `/plugin install archmantic@archmantic` | Very High · Med |
| ✅ done | Path aliases + de-noised surfaces (1.19.1) | `tsconfig`/`jsconfig` `paths` resolve to internal files (fake `@/lib` externals gone; internal edges 8 → 176 on a real Next.js app — INS-021); every human/agent surface filters to real external systems; AI SDKs classified `saas` (INS-019) | High · Low |
| ✅ done | Node 20 floor (1.19.2) | `engines.node` `>=24` → `>=20` (only `node:sqlite`/db-check needs 22.5+, already guarded) — kills the `EBADENGINE` noise on the common default Node | Med · Low |
| ✅ done | Usage loop fixed + global token (1.19.3) | Tolerant `usage.jsonl` parsing (one corrupted line no longer blanks the log — INS-023), `get_architecture_map` in the broad-savings baseline, `~/.archmantic/.env` user-level `ARCHMANTIC_TOKEN` fallback so every project reports to `/usage` | Med · Low |
| ✅ done | Web redesign (dev-tool aesthetic) | Vercel/Next/Laravel-school visual language: neutral high-contrast base + warm coral accent, Geist type, new landing (two-audiences thesis band, trust band), coral facet nav/rail — replaced the purple-gradient look | Med · Med |
| **DEFER** | Function-level tracking | Red-ocean; dilutes positioning. Drill-down only, if ever | Low · High |

## Next — future development & missing areas

The MVP, Spec/Skills layers, the experience layer, and the Claude Code plugin have
shipped (M0–M6 + 1.3.0–1.19.3, plugin 0.4). What follows is the forward plan, grouped
by theme and judged against the north star: does it make the model more
**trustworthy**, more **useful to agents**, or more **adoptable** — without sliding
into code-graph commodity territory. Each item names the gap it closes (verified
against `src/` as of 1.19.3).

### Hardening backlog — July 2026 audit (do these before new features)

A three-reviewer audit (core / web / plugin+docs) surfaced concrete, verified defects.
Highest first; file refs are in the audit PRs and `docs/INSIGHTS.md`.

| # | Sev | Finding | Fix sketch |
|---|---|---|---|
| H1 | high | **`incrementalUpdate` diverges from full `analyze`** — never re-runs data-model/endpoint/feature detectors or `refineRoles`/`tagPackages`, and **deletes Laravel Blade/Livewire components on every `update`** (they're not in `walkSourceFiles`' current-set). The pre-commit hook slowly degrades committed models. | Re-run the cheap detectors in `incremental.ts`; exempt non-JS component ids from the current-set filter; add an equivalence test vs `analyzeRepo` |
| H2 | high | **`update` clobbers feature flows** — incremental ends with `deriveProcessAndFlow`, resetting `flows`/`processes` to the single entry-point chain instead of re-deriving feature flows like `analyze` does. | Mirror `index.ts`'s `deriveFeatureFlows` override in `incremental.ts` |
| H3 | high | **Web: permanently-cached mutable snapshots** — `modelAtCommit` uses `unstable_cache(revalidate: false)` but pushes upsert the same `commit` row (`"working-tree"` default) → the web serves stale models forever; `null` misses are cached too. | Bypass cache for `working-tree` / tag + `revalidateTag` on push |
| H4 | high | **Web: unvalidated push body can 500 a project page** — `/api/push` stores any JSON unchecked; a model missing top-level arrays crashes `trust()`/`page.tsx` server-side until a good push replaces it. | Validate minimal shape in the route (400) + default missing arrays on read + size cap |
| H5 | med | **Non-atomic `model.json`/`AGENTS.md` writes** — plugin-era = multiple concurrent MCP servers; a reader mid-write gets truncated JSON (server dies at startup). | `write tmp + renameSync` in `reanalyze()`/`persistModel()` |
| H6 | med | **`curate` merge destroys prior curation** — shallow domain spread + undefined fields drop a previously-curated `name` when only `description` is sent. | Per-slug merge of defined fields only; test the MCP write tools |
| H7 | med | **Usage backlog re-sends last 1000 events on every server spawn** (no watermark, log never rotated) and misreports the count. | Persist a synced high-water mark; rotate the log; report actual pending |
| H8 | med | **No timeout on cloud fetches** — a stalled connection hangs MCP tool calls (`sync`, `suggest_links`) forever. | `AbortSignal.timeout(15s)` in `cloud/api.ts:send()` |
| H9 | med | **`loadAliases` misses `extends` + workspace-member tsconfigs** — monorepos with `tsconfig.base.json` paths get zero aliases (the 1.19.1 fix doesn't reach them). | `ts.parseJsonConfigFileContent` + per-member configs |
| H10 | med | **`npm test` broken on Node 20** (the supported floor) — `--test` glob needs Node ≥21; CI runs 24 so it's invisible. | `"test": "node --test test/"` + CI on Node 20 |
| H11 | med | **Plugin PreToolUse hook auto-approves the nudged call** — returning `permissionDecision: "allow"` bypasses the permission prompt for that Read/Grep/Glob. | Return only `additionalContext` (fixed in plugin 0.4.1) |
| H12 | low | Cross-platform `CURATION_PATH` (win32 `\` in provenance refs breaks `isCurated` cross-OS); hardcoded MCP server version string; unhandled rejection in the startup feature-pull `.then`; recomputed components lose role refinement/package tags (subsumed by H1) | Small individual fixes |
| H13 | low | **Web polish batch** — `flowGraph` drops steps whose target isn't a participant; simpleicons black logos invisible on dark; feature-editor sends unfiltered empty/untrimmed lines; raw DB error text rendered to users; snapshot picker discards query params; `focusNode` never cleared; `processGraph` roles have no CSS vars; docs page says "Node 24+" and `am_xxx` tokens | One batch PR |
| H14 | low | **Plugin hygiene** — tmpdir markers never cleaned (add SessionEnd unlink); tmp-unwritable path nags every call (contradicts comment); `nosession` fallback dedupes across sessions; verify `cwd` key support in plugin `.mcp.json` and `disallowedTools` in agent frontmatter | Small batch with 0.4.x |

**Test gaps to close with H1/H2:** incremental-vs-full equivalence on a non-empty base; `loadAliases`/`resolveAlias`; `UsageRecorder` failure paths; `cloud/api` with stubbed fetch; MCP write tools (`refresh`/`sync`/`curate`); two-process write safety.

### Top candidates (highest signal first)

| Item | Theme | Why now | Impact · Effort |
|---|---|---|---|
| **Architecture rule/violation engine** | trust | Cycles, layering violations, change-amplifier hot-spots — turns the model from *descriptive* to *prescriptive*. The `monorepo-dependency-map` skill already *recommends* this; nothing computes it. Model-native, defensible, not code-graph. **Must stay generative, not a straitjacket** (principles below). | High · Med |
| **Breaking-change detection in `diff`/PR diff** | trust | Lead with **cross-repo consumer impact** ("this PR removes `GET /orders/:id`, which `billing` consumes") — nobody does contract-breakage at the architecture level. The teeth on the PR-diff USP; promote it. | High · Med |
| **Language expansion (backend langs + mobile family)** | adoption | Two families, not five equal parsers (below). Backend-pattern langs reuse the endpoint/data-model detectors; mobile needs new projections. Biggest adoption lever. | High · High |
| **Web parity for CLI-only power** | adoption | Bring model-side flows into the hosted app for the non-CLI audience (PM/architect/EM) — the adoption + per-seat monetization bridge. "Bring vs show" split below. | Med · Med |
| **Skills/agent usage stats** | agents·stats | Track *which* skills/agents the MCP serves (not just that `get_skill` was called) and surface on web `/usage` — proves the shelf earns its keep and informs the catalog + future registry. Small, reuses the metering substrate. | Med · Low |
| **Skills v2 — remote shelf + execution** | agents | Signed remote registry (the "on-shelf when needed" vision), gated skill execution / agent invocation (today skills are data-only), web skill add/author. | Med · Med-High |
| **Billing/metering on the usage substrate** | platform | The event stream + `/usage` dashboard already exist (the metering substrate, D6). Turn it into the open-SaaS revenue path (per-seat + metered AI). | High · Med |

### By theme

**0 · The experience layer — collect → curate → present (the headline concept).**
Full design: **[docs/design/EXPERIENCE-LAYER.md](./design/EXPERIENCE-LAYER.md)**. One grounded model, two audiences, an AI layer between.
- **Collect (deterministic, cheap):** classify externals so **libraries are `Technology`, never `System`** (kills the `lucide-react`/`node:fs`-in-the-context-diagram noise); deterministic groups (folder/role/package) as the cold-start scaffold. *Fixes ~6 of the diagram complaints with no AI.*
- **Curate (AI, incremental, cached, grounded):** an LLM pass that reads the full model and produces the **human** layer — discovers & names domains, writes plain-language descriptions, ranks what matters, and generates the project's **positioning narrative** ("what this is, how it's shaped"). Never invents structure; carries `llm` provenance + an "AI-curated" trust band. Incremental via the architecture diff, cached per snapshot, tiered (Haiku/Opus), BYOK/managed — the monetizable premium on the existing usage substrate, triggered by the CI reconciler (collect → curate → push).
- **Present (per audience):** humans get the **Architecture Map** (auto C4 L1/L2, curated domains as containers — the new hero/front door), Context (classified boundary), Components (clustered, libraries collapsed), feature **journeys** + on-demand behavior **sequences** (scoped to a feature/endpoint, *not* import edges), a feature map, rendered Knowledge, a Changes **timeline**, and a first-class microservices **System landscape**. Diagrams stop being a destination — they become zoom levels inside the facet that owns the question. Facets consolidate ~13 → ~8 (Capabilities folds into component detail + domain descriptions; Knowledge folds into Overview). Agents get the grounded model + curated summaries over MCP (`get_architecture_map`).
- **IR (schema 0.1.0 → 0.2.0):** `Group`/`Component.groupId`; `System.externalKind` + `uses_library` relation; `FlowStep.kind` + `Flow.trigger` (behavior, feature-scoped); `Process.featureId`/`lanes` (journeys); curated `description`/positioning fields with `llm` provenance.

**1 · Trust & accuracy (the core differentiator).**
- **Architecture rule/violation engine** — and it must *leave room for new ideas*, not freeze the design. Principles:
  - *Advisory by default*, CI-gating only on per-rule opt-in (severity: info / warn / error).
  - *Baseline-ratchet, not zero-violations* — snapshot today's architecture as the baseline; flag only **new** violations (regressions). Existing structure and deliberate redesigns are grandfathered.
  - *Rules-as-data, team-authored* (mirror the Skills shelf) — ship a starter set; teams author/extend their own constraints. The engine is a substrate for *this team's* evolving intent, not one imposed notion of "clean."
  - *Violations can become decisions* — an acknowledged violation + reason records an intentional exception (a lightweight ADR) with provenance, instead of nagging forever.
  - *Surface emergent/positive structure*, not just faults (a forming cluster, a god-module, a shareable service) — propose improvements, don't only police.
  - *Check against the Spec layer* — validate structure against stated intent (features/manifest) so rules follow when intent changes.
- **Breaking-change detection** — removed/renamed endpoints, changed methods/paths, removed capabilities, schema-breaking field/entity changes, removed consumed exports. **Lead with cross-repo impact** via the multi-repo link graph (consumer-aware). Promote as "PR review that tells you what *breaks*, including downstream repos."
- Schema-drift: extend `db-check` from presence-only to **type/nullability** comparison (deferred in 1.15.0 for false-positive risk — revisit with a normalized type map).
- Tier 3 (runtime): ingest traces/observability to confirm declared vs actual call paths (long-deferred; the highest-confidence grounding source).

**2 · Language & framework coverage (adoption) — two families.**
This is where the long-deferred **tree-sitter** substrate finally pays off: one parsing layer, per-language grammars + per-framework detectors. The IR is already language-agnostic — the work is walkers + detectors (+ new projections for mobile).
- **Backend-pattern languages** — reuse the existing `Endpoint`/`DataEntity` shapes: **Python** first (Django/FastAPI/Flask; SQLAlchemy/Django ORM), then **Java/Kotlin (Spring)** (`@RestController`, JPA) and **C#/.NET** (ASP.NET controllers, EF). Lowest friction, highest backend adoption.
- **Mobile family** — **Swift (SwiftUI)** and **Kotlin (Compose/Android)**. No HTTP surface; the valuable projections are **screen/navigation graphs, view-model dependencies, networking clients** — a distinct workstream, *not* "another grammar." The Spec layer (features + behavior flows) already fits mobile screens well.
- Other detectors: **TypeORM** (the one open ORM detector since the ERD work), Mongoose, ActiveRecord; **OpenAPI/Swagger ingestion** (deferred in 1.5.0 awaiting a populated spec) and gRPC/proto for service contracts.

**3 · Agent plane / Skills & stats (useful to agents).**
- **Skills/agent usage tracking** — extend the usage event with the *subject* (skill slug / suggested agent) so `suggest_skills`/`get_skill` record which specific skills were surfaced/served; aggregate a "Skills served · agents suggested" panel on web `/usage`. Proves the shelf's value and feeds catalog/registry decisions. Small; reuses `src/mcp/usage.ts` + the cloud event stream.
- **Skills v2** — remote skill registry + signing; gated execution/agent invocation; web skill management (see docs/design/SKILLS.md "Future").
- A provenance-carrying **write/propose** MCP tool so an agent can suggest model/feature edits for human review (today writes are `refresh`/`sync`/`sync_features` only).
- Harden the autonomous build (`handoff --apply`): tighter sandboxing, broader verification.

**4 · Web parity & UX (adoptable) — "bring vs show".**
The hosted app can't see the user's disk, so split parity explicitly:
- **Bring to web** (operates on the *pushed model* — fully hostable):
  - **AI `feature sync`** — "AI compile" on a feature: edit the description → review proposed shows/actions/implied features as a diff before save (the marquee edit-then-build-for-the-spec demo; server-side key = a monetization touch point).
  - **Build-spec / hand-off view** — render the agent-ready spec from the model; copy/download; "generate plan".
  - **Skill management UI** — add from URL, author/edit local skills, toggle which apply.
  - **Architecture timeline** — drift% + added/removed elements across commits (compelling for EMs).
  - **Per-package (monorepo) detail** and a **provenance deep-dive panel** (every `file:line` ref for an element, with source links).
- **Show results in web** (inherently local → surfaced via CI/CLI, not run in-browser): true **`drift`** vs working tree and local file editing stay CLI/CI; the web displays the pushed result (e.g. CI pushes a drift snapshot → a drift status badge per project).

**5 · Platform & business.**
- Billing/metering (above); org settings, roles, and team management beyond token CRUD.

### Decided · bidirectional web ↔ agent sync = git-as-transport + repo-canonical proposals
The local constraint (the hosted app can't reach the dev's disk) is solved by making **git the message bus** — the one channel both sides reach, and already the source of truth. The cloud DB demotes to a cache/projection, not a second source of truth.
- **Web → repo:** web edits are written as commits on a dedicated branch / PR via a git-host App (GitHub first). They are **proposals** — never silently overwriting; the human/agent reviews and merges. Git's 3-way merge + PR review handle history, attribution, and conflicts for free.
- **Repo → web:** **CI as the always-on reconciler** — a GitHub Action runs `analyze && push` on every commit (the PR-diff Action already exists), so the cloud always reflects the repo with no dev box online.
- **Conflict stance:** **repo-canonical, web-edits-as-proposals.** Every edit carries its **base model version/commit** so divergence is detectable; conflicts surface to the human (via the PR), they're never auto-resolved against the repo.
- **Sequencing:** (1) now — polling+ (interval poll, base-version cursor on edits); (2) the bet — git-host App + CI reconciler; (3) only if real-time proves necessary — an outbound SSE nudge from the long-running MCP server via a managed realtime service (don't build speculatively).

### DEFER (still red-ocean / premature)
- Function-level tracking (see below).
- Platform-orchestrated "Managed Agents" building — keep BYOK-first until the edit-then-build loop proves out.

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
- Project: React Flow ERD ✅. "Data" tab in the project view ✅ + MCP `get_data_model` ✅.
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

### ✅ done · Spec layer Phase 2 — feature layer (1.9.0)
User-perspective features on top of the structure (docs/design/SPEC-LAYER.md). New
`Feature` IR type (`description`, `shows[]`, `actions[]`, `dependsOn[]`,
`components[]`) authored as git-versioned `.archmantic/features/<slug>.md`
(frontmatter + `## Shows`/`## Actions`); seeded bottom-up from page/route/view
components (status "draft", path-aware names so sibling `add.vue`/`show.vue` don't
collapse; tests excluded). Authored files win over seeds. Surfaced via MCP
`list_features`/`get_feature`, CLI `feature [list|show|seed]`, and a web Features
facet. Next (Phase 2b): the intent compiler (`feature sync`, BYOK) — edit a
description → create/update related features. Then Phase 3: feature-scoped flows.

### ✅ done · Spec layer Phase 2b — feature intent compiler (1.10.0)
The edit→analyze→update loop for the spec (docs/design/SPEC-LAYER.md). Edit a
feature's description, then `archmantic feature sync` (BYOK, Opus 4.8 via the
Tier-2 plumbing) reads the authored `.archmantic/features/*.md` + the repo's
building blocks (pages/routes/components) and compiles: fills shows/actions/
dependsOn, CREATES features implied by a description (e.g. "a vendors section" →
a Vendors feature) and wires the parent's dependsOn, grounding `components` only
to real file paths. Written back as feature files (dry-run by default; `--write`
to save). Agents can run it over MCP (`sync_features`). Gated/graceful without an
Anthropic credential. Also shipped: Vercel Analytics + Speed Insights in the web
app. Next: Phase 3 — feature-scoped behavior flows.

### ✅ done · Usage push-stats + feature seed polish (1.11.0)
Usage now also records **model pushes** (kind "push"): the CLI `push` and MCP
`sync` emit a push event to the durable usage outbox (idempotent, flushed via the
shared `flushUsageEvents`); `archmantic usage` and the web `/usage` dashboard
separate reads (token savings) from pushes ("N model pushes"). `archmantic_usage`
gains a `kind` column (default 'read'). Feature seeding hardened: App Router-aware
names (`app/.../page.tsx`, route groups `(x)`, dynamic `[id]`) and cleaner
descriptions ("The X screen.") instead of "X page page.".

### ✅ done · Spec layer Phase 3 — feature-scoped behavior flows (1.12.0)
The entry-point-chain derivation produced 0 processes/flows for web apps. Now each
feature gets a flow from its component subgraph (`src/analyze/flows.ts`
`deriveFeatureFlows`): page → components it renders → external services it calls,
each step grounded to the import edge's file:line, richest-first. These become
`model.flows` (and a synthesized primary `process`) when present; the CLI
entry-point flow stays the fallback for repos without features. Surfaced in the web
feature detail (Flow list), the Sequence diagram (flows[0]), and MCP `get_feature`.
Verified: fantasy 0 → 70 flows, SocialSeed 0 → 40, DrivePulse 0 → 11. Also in
1.12.0: the `amt` bin alias was removed (collided with macOS `/usr/sbin/amt`).
Still planned: feature edit/update in the web (write authored feature files back).

### ✅ done · Web feature editor — repo files as source (1.13.0)
`archmantic edit` serves a dependency-light localhost UI (node:http + embedded
HTML, `src/editor.ts`) to edit feature description/shows/actions/dependsOn; saves
POST to a local endpoint that writes `.archmantic/features/<slug>.md` directly via
`writeFeatureEdit` → `featureFileMarkdown`. Repo files stay the source of truth
(git-diff + `analyze`); the hosted Vercel app stays read-only since it can't reach
the user's disk. The web Features facet points to the three edit paths (files /
`edit` / `feature sync`). Completes the feature edit/update ask.

### ✅ done · Hosted feature editing → cloud → pull (1.14.0)
Edit features in the hosted web app (read-only before) — saves go to a cloud table
`archmantic_feature_edits`. The repo stays the
source of truth: `archmantic feature pull` writes pending edits into
`.archmantic/features/*.md` (org-token scoped, last-write-wins), and the MCP server
**auto-pulls on startup** so web edits flow into the repo while an agent works —
polling, since webhooks can't reach a dev machine. Web: editable feature cards
(`components/feature-editor.tsx`) POST to `/api/feature`; CLI reads via
`/api/feature-edits`. Both edit paths now exist (local `edit` + hosted), and the
interactive diagrams are fully on xyflow (Sequence + Process per-feature decks).

### ✅ done · Schema-drift check (1.15.0)
`archmantic db-check` — the originally-scoped "1.8.0" feature (deferred while the
spec layer was built). Compares Laravel migrations (the committed model, via
`detectLaravelMigrations`) against the **live database**: reads `.env` `DB_*`,
introspects MySQL (`mysql2`), PostgreSQL (`pg`), or SQLite (built-in `node:sqlite`)
and reports tables/columns present in one side but not the other (`src/drift/
schema-drift.ts` pure compare; `src/analyze/db-introspect.ts` connects). Presence-
only (type/nullability deferred — Laravel-vs-DB type naming is too fuzzy to avoid
false positives). Opt-in, never part of `analyze`; credentials/results never
persisted; `--check` is a CI gate. DB drivers are optionalDependencies so the core
install stays lean. 71 tests (live SQLite round-trip skips on Node <22.5).

Also in 1.15.0: **used-libraries detection** — `detectStack` now adds every *runtime*
dependency that isn't a curated tech as `category: "library"` (package.json
`dependencies` + composer `require`; devDeps/`require-dev`/`php`/`ext-*` excluded).
The full library list shows under a collapsible "Libraries" in the web Overview;
the curated stack still leads the knowledge file / terminal (a "+N libraries" note
keeps those concise).

### ✅ done · Real sequence diagrams + Mermaid removed (1.16.0)
A dedicated React Flow sequence view (`web/components/sequence-diagram.tsx`):
participant lifelines, activation bars, ordered labeled messages, self-message
loops — driven by a `flowSequence` projection that keeps every step in time order
(unlike `flowGraph`, which collapses repeated edges). And Mermaid was dropped
everywhere: the web renders all graphs with React Flow; the CLI's standalone HTML
viewer uses native HTML tables/lists. (BPMN/`bpmn-js` was later removed too — the
process renders as React Flow like every other view.) Removed the dead `.mmd`
exports and the Mermaid string-generators from core + web.

### ✅ done · Skills — model-resolved playbook catalog (1.17.0)
An on-shelf catalog of reusable playbooks **resolved against the grounded model**
(see docs/design/SKILLS.md). Each skill declares triggers (`tech:`/`category:`/
`external:`/`role:`/`entity`/`endpoint`/`feature`/`process`/`monorepo`/`always`)
matched against model facts, scored and ranked with **cited reasons** ("Laravel
detected", "external dependency: Stripe"). Three supply layers: builtin catalog
(`src/skills/catalog.ts`, 8 skills, bundled data), local `.archmantic/skills/*.md`,
and remote (`archmantic skill add <url>` fetches markdown into the local cache).
Skills are **data — recommended, never auto-executed**; the agent/human decides.
Surfaced via MCP `suggest_skills`/`list_skills`/`get_skill`, CLI `skill
[suggest|list|show|add]`, and a web **Skills** facet (resolved builtin shelf,
grounded "why", collapsible playbook). The wedge: model-driven resolution, not a
flat marketplace. Next (Skills v2): signed remote registry, gated skill execution/
agent invocation, web skill-management UI.

### ✅ done · Experience layer — collect → curate → present (1.18.0)
The big rethink (see [design/EXPERIENCE-LAYER.md](./design/EXPERIENCE-LAYER.md)): diagrams were
mechanical because they projected the raw import graph. Fixed across three layers.
- **Collect:** `classifyExternal` tags externals datastore/saas/infra/service/**library**/runtime
  (`System.externalKind`); graphs draw real systems only, libraries move to a **Dependencies**
  page (with versions). Test files excluded from the model. Semantic **Groups** (domains from
  folder/package, layers from role) — the missing middle level; schema 0.2.0.
- **Present:** a new **Architecture Map** (C4 L1/L2: domains as containers + the external
  systems they touch, drill to components). Curated narrative on Overview.
- **Curate (agent-driven, no managed LLM):** the user's own agent names domains / writes
  descriptions + a positioning narrative over MCP (`get_architecture_map` → `curate`) on its
  own tokens, merged via committed `.archmantic/curation.json`; **BYOK CLI `curate`** and
  **`publish [--ai]`** (analyze → curate → push) are the run-it-for-me fallback. Decisions:
  committed storage, agent-driven, on-demand+incremental — monetization deferred.

### DEFER · Function-level tracking
Red-ocean. Revisit only as an optional drill-down if a concrete user need
appears that architecture-level elements can't serve.
