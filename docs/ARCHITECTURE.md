# Archmantic — Technical Architecture

> Status: **Design v0.2** — derived from `docs/CONCEPT.md`, reconciled with the shipped system (through 1.17.0). Last updated: 2026-06-18.
> This describes *how* we build the platform. Recommendations are decisive; anything marked **(confirm)** is a judgment call worth a second look before we commit code.
>
> Two layers above the original reverse-engineered structure have since shipped and are documented here: the **Spec layer** (§2.5, human-authored intent — see `docs/design/SPEC-LAYER.md`) and the **Skills layer** (§8.5, model-resolved playbooks — see `docs/design/SKILLS.md`). The model-first / provenance-on-every-derived-element invariant holds for all of it.

---

## 1. The central design idea: model-first, diagrams are projections

The single most important architectural decision: **we do not generate diagrams directly from code.** We generate a **canonical Architecture Model** (an intermediate representation — "the IR"), and every diagram is a *rendered projection* of that model.

```
                 ┌──────────────────────────────────────────┐
   sources  ───▶ │  Analysis pipeline (tiered, cost-aware)  │ ───▶  Architecture Model (IR)
 (repo, code,    └──────────────────────────────────────────┘                │
  runtime)                                                                    │
                                              ┌──────────────────────────────┼──────────────────────────────┐
                                              ▼                              ▼                              ▼
                                      Context diagram            Sequence diagrams              BPMN / process
                                      (projection)               (projection)                  (projection)
                                              │                              │                              │
                                              └──────────────┬───────────────┴──────────────────────────────┘
                                                             ▼
                                            Humans (rendered SVG)   +   Agents (MCP queries over the IR)
```

**Why this matters for every requirement:**
- **One source, many views** — context/sequence/BPMN all derive from the same model; no drift between them.
- **Editable** — editing a diagram = editing the model; "then build" emits a spec from the model.
- **Agent-queryable** — MCP serves *structured model queries* ("what calls the payment service?"), not just diagram images. This is where the token savings come from.
- **Grounded/trustworthy** — every model element carries **provenance** (the `file:line` / commit / trace it was derived from), which is how we make reverse-engineering *verifiable* rather than plausible-looking.

The IR is the product. Diagrams and MCP are interfaces onto it.

---

## 2. The Architecture Model (IR)

A versioned graph (`src/ir/types.ts`, `SCHEMA_VERSION 0.1.0`). The full set of element types as shipped — every one extends `ElementBase` (id, name, description?, **provenance[]**, **confidence**, package?):

| Element | Examples | Key fields beyond the base |
|---|---|---|
| **System** | the project itself, external systems | kind (`internal`/`external`) |
| **Component** | service, module, package, layer | kind, role (route/page/hook/store/service/…), systemId, responsibility |
| **Actor** | user role, external system, scheduler | kind (`user`/`external_system`/`scheduler`/`other`) |
| **Relation** | calls, depends-on, publishes-to, reads | from, to, kind (`calls`/`depends_on`/`publishes_to`/`subscribes_to`/`reads`/`writes`) |
| **Flow** | a sequence (checkout, login) | participants[], steps[] (each `file:line`-grounded), featureId? (Spec layer) |
| **Process** | a business process (BPMN) | tasks[] (gateways/events/lanes deferred) |
| **Capability** | the lightweight auto-derived "what can it do?" layer | componentIds[] |
| **Technology** | detected framework/lib/db/orm/auth/ai/… | category (framework/ui/database/orm/auth/ai/testing/build/language/infra/library) |
| **Feature** | user-perspective product feature (Spec layer) | shows[], actions[], dependsOn[], components[], status — see §2.5 |
| **DataEntity** | a DB table / ORM model (projects to ERD) | fields[] (DataField: type, optional, list, isId, isUnique, relationTo, isForeignKey) |
| **Endpoint** | REST route / tRPC procedure / GraphQL field | method, path, protocol (`rest`/`trpc`/`graphql`) |

Plus two human-intent records on the model itself (Spec layer, §2.5): **ProjectManifest** (the "project brain" — goal, status, author/owners, links, agent team, history) and the **Author**/**AgentRef** it references.

Every derived element and relation carries:
- `provenance[]` — list of `{source, ref, confidence}` (e.g. `{code, "src/pay/charge.ts:42", 0.9}`). **No element without provenance** (except user-authored edits, tagged `source: human`).
- `confidence` — drives the "is this trustworthy?" surface and the tiered escalation (low confidence → escalate to a deeper, costlier analysis tier).

Stored as **diffable text** (one canonical JSON/YAML doc per project, or sharded per subsystem) so it version-controls cleanly in the repo.

---

## 2.5 The Spec layer (human-authored intent on top of structure)

The tiered pipeline (§3) reverse-engineers *structure*. The **Spec layer** adds the *intent* a machine can't read off code — authored by humans and agents, kept live, and merged into the one model so diagrams/MCP/web stay projections. Same invariants: model-first, repo files are the source of truth (git-versioned, agent-editable, diffable), `source: "human"` provenance on authored elements. Full design: **`docs/design/SPEC-LAYER.md`**.

Three shipped phases, top to bottom:

1. **Project brain** — `.archmantic/project.json` (`ProjectManifest`): goal, status, author/owners, links, the agent team (auto-seeded from `.claude/agents/*.md` when unset), and a history log. Merged into `model.manifest` during `analyze`; leads the Knowledge/web header; surfaced via MCP `get_project`.
2. **Feature layer** — `.archmantic/features/<slug>.md` (frontmatter + `## Shows` / `## Actions` / `## Depends on`) → the `Feature` IR type. Seeded **bottom-up** from page/route components when no file exists; **authored files win** (provenance flips to human once edited). Surfaced via MCP `list_features` / `get_feature`. `Feature` is the richer user-perspective layer; `Capability` stays the lightweight auto-derived one.
3. **Intent compiler** — `archmantic feature sync` / MCP `sync_features`: a BYOK Claude **Opus 4.8** pass (adaptive thinking, JSON-schema structured output) that fills `shows`/`actions`/`dependsOn` from each feature's description and **creates implied features** (e.g. "a vendors section" → a `Vendors` feature), writing the results back as files.

Behavior is captured as **feature-scoped flows** (`Flow.featureId`) — per-feature, function-level sequences with `file:line` provenance on each step — not a global call graph (deliberately deferred).

---

## 3. The tiered analysis pipeline (Decision #1 — cheapest-first, escalate, stop when enough)

The pipeline produces/updates the IR. Each tier is more expensive (in tokens/time) than the last; we run the cheapest, check sufficiency, and **only escalate the parts that are still low-confidence.**

| Tier | Source | Cost | What it extracts | Tech |
|---|---|---|---|---|
| **0** | Repo structure & manifests | ~free | systems, top-level components, dependency edges, entry points | file walk, parse `package.json`/`pyproject`/`go.mod`/etc., lockfiles |
| **1** | Static code analysis | cheap, deterministic | imports/exports graph, routes, call edges, public APIs | **tree-sitter** (multi-language), language servers where available |
| **2** | LLM semantic pass | metered tokens | responsibilities, capability descriptions, flows/sequences, naming intent | **Claude** — Haiku for summarization, Opus 4.8 for synthesis (see §7) |
| **3** | Runtime / observability *(later)* | infra-dependent | *real* sequences & frequencies, confirms Tier 1–2 guesses | OpenTelemetry traces, logs |

**Escalation logic:** after each tier, compute coverage/confidence. If a subsystem is well-described by Tier 0–1, *skip the LLM for it*. Only feed ambiguous/low-confidence regions to Tier 2. This is the core of "start from lowest consumption, skip if enough" — and it's also what keeps the LLM bill bounded on large repos.

**Incrementality (Decision #10):** on change, diff against the last analyzed commit → re-run only the tiers needed for the touched files/subgraph → patch the IR → re-render only affected diagrams. We never re-analyze the whole repo on a one-file change.

---

## 4. Diagram representation (Decision #3)

Requirement: human-visual + agent-readable + diffable + renderable + standards-aligned. Recommendation:

| Diagram | Format | Rationale |
|---|---|---|
| Context / components / sequence / ERD | **React Flow** (`@xyflow/react`) graphs in the web; native HTML tables/lists in the CLI viewer | interactive (pan/zoom, click-through, role colour), full layout control, no opaque renderer; the IR drives node/edge builders directly |
| BPMN / process | **BPMN 2.0 XML** (rendered/edited via `bpmn-js`) | the actual industry standard for business processes; editable canvas |

**Decision:** the architecture diagrams are projected to **React Flow** graphs (the web is the interactive viewer); processes use true **BPMN 2.0**. Mermaid was removed — its layout/handling was too limiting and a text-source renderer can't give the interactive sequence diagram (lifelines + activation bars) we want. The CLI ships a dependency-light self-contained HTML viewer (tables/lists) plus the BPMN as a portable artifact.

These rendered artifacts are **derived** — the IR is the source. We can regenerate them anytime.

---

## 5. Storage & sync (Decisions #5, #10)

**Both in-repo and platform-indexed:**

- **In-repo:** a committed `.archmantic/` directory — the IR doc(s) + generated diagram sources. Versioned with the code, travels with the project, reviewable in PRs. This is the source of truth for OSS/free usage.
- **Platform store:** the IR is *also* indexed in **Neon** (serverless Postgres + pgvector for capability search) to power the web UI, editing, cross-project features, and fast MCP queries. The platform store is a **cache/index of the repo**, not a competing source — repo wins on conflict, edits flow back as commits.

**Sync triggers:** local CLI/file-watch for dev loop; Git hook / CI job for "on every change"; explicit "regenerate" from UI or agent. Version history = Git for the in-repo copy + an append-only revision log in the platform store.

---

## 6. MCP server (Decision #6 — bidirectional)

The MCP server is how agents consume (and the token-savings story). It exposes **structured tools over the IR**, not raw files. As shipped (`src/mcp/server.ts`, 1.17.0) it registers **19 tools**:

**Read tools (agent ← Archmantic):**
- `get_context` — system context, externals, counts, primary process (compact)
- `get_project` — the project brain (goal, status, author, agent team, history) — the "why"
- `list_components(filter?)` / `get_component(name)` — components + responsibilities; one component's relations & provenance
- `search_capabilities(query)` — "what can this system do?" capabilities matching a query
- `get_process` (BPMN) / `get_sequence` — primary process steps; primary call/dependency sequence
- `get_data_model` — DB entities/fields with PK/FK/unique markers + relations (the ERD)
- `get_api_surface` — REST/tRPC/GraphQL contract grouped by protocol
- `suggest_links` — inferred/dangling cross-repo `consumes` edges vs the org's other repos
- `list_features` / `get_feature(name)` — the Spec-layer feature intent (shows/actions/dependsOn)
- `whats_related(name)` — graph neighborhood (the big token-saver: "what touches checkout?" returns ~200 tokens, not 20 files)
- `suggest_skills` / `list_skills` / `get_skill(name)` — the Skills layer (§8.5): model-ranked playbooks with grounded reasons, the shelf, and one skill's body

**Write tools (agent → Archmantic):**
- `refresh` — re-analyze the repo from disk and update the served model + `.archmantic/model.json`
- `sync_features` — run the BYOK intent compiler (§2.5) and write features back
- `sync` — re-analyze and push the model to the team cloud, returning what changed

Built on the official MCP TypeScript SDK; ships as a process the user's existing agent (Claude Code, Cursor) points at — satisfying "plug in first" (Decision #9). Every read call is metered (§8.6) for the proof-of-value loop.

**Token-savings measurement is built into this layer:** every MCP response logs tokens returned; we run a benchmark harness comparing "agent answers task via MCP" vs "agent answers via raw file reads" and report the delta. This is a first-class feature, not an afterthought — it's the proof behind the headline value prop.

---

## 7. LLM usage (Tier 2 synthesis)

We use **Claude** via the Anthropic TypeScript SDK (`@anthropic-ai/sdk`), tiered to match the cost-aware pipeline:

| Job | Model | Why |
|---|---|---|
| Per-file/component summarization, capability descriptions | `claude-haiku-4-5` | cheap, high-volume, simple |
| Flow/sequence synthesis, cross-component reasoning, ambiguity resolution | `claude-opus-4-8` | hardest reasoning; highest quality |

- **Adaptive thinking** (`thinking: {type: "adaptive"}`) + **`effort`** tuned per job (low for summaries, high for synthesis).
- **Structured outputs** (`output_config.format` with a JSON schema) so the LLM emits IR fragments directly — no brittle parsing.
- **Prompt caching** on the stable parts of analysis prompts (the IR schema, instructions) to cut cost on high-volume Tier-2 runs.
- **Provenance is mandatory in the schema** — the model must cite the `file:line` it based each element on, or the element is rejected. This is the guardrail against plausible-but-wrong output.

*(These are current Opus 4.8 / Haiku 4.5 facts as of this writing; confirm model IDs at build time.)*

---

## 8. Form factor (Decision #11)

| Surface | Role | Stack |
|---|---|---|
| **CLI** (`archmantic`) | primary for devs/advanced; powers init, analyze, serve-MCP, preview | Node/TS, single binary-ish via npm |
| **Web platform** | manage projects, view & **edit** diagrams, subscriptions | Next.js (React) on **Vercel** + **React Flow** (`@xyflow/react`) graphs + `bpmn-js` (BPMN editor); **Neon** Postgres; the editable canvas |
| **MCP server** | agent integration | MCP TS SDK (shipped by the CLI: `archmantic mcp`) |

CLI commands (MVP-ish): `archmantic init`, `archmantic analyze [--tier N]`, `archmantic mcp` (start server), `archmantic view <diagram>` (terminal preview — render to image + iTerm2/Kitty inline protocol, ASCII fallback). **(confirm)** in-terminal image preview is feasible on modern terminals; we degrade to "open in browser" elsewhere.

**One language everywhere: TypeScript.** Aligns with the existing scaffold, gives the best MCP SDK, and lets CLI + web + server share the IR types. tree-sitter has solid Node bindings.

---

## 8.5 The Skills layer (model-resolved playbooks)

Shipped 1.17.0 (`src/skills/`). A skill is a reusable **playbook** (a markdown body an agent applies, optionally tagged with an advisory subagent). The differentiator over a flat marketplace: skills are **resolved against the grounded model**, not browsed. Each skill declares **triggers** matched against model facts, and the resolver scores and ranks them, carrying a concrete *reason* for every hit ("Laravel detected", "external dependency: Stripe") so a recommendation is never a black box.

- **Triggers** (`SkillTrigger`): `tech:<name>`, `category:<cat>`, `external:<name>`, `role:<role>`, presence checks `entity` / `endpoint` / `feature` / `process`, `monorepo`, and `always`. Weighted cheapest-signal-loses: a named `tech`/`external` (1.0) outranks a `category` (0.7), `role` (0.6), presence (0.5), and the `always` baseline (0.1).
- **Three supply layers:** **builtin** (`src/skills/catalog.ts`, 8 bundled skills, no IO/network), **local** (`.archmantic/skills/*.md`, authored or fetched — local wins over builtin by id), **remote** (`archmantic skill add <url>` fetches markdown into the local cache, recording a provenance line).
- **Safety boundary — data only, never executed.** Archmantic *recommends*; the agent or human decides whether to apply. No skill ever runs from here.
- **Surface:** MCP `suggest_skills` / `list_skills` / `get_skill`; CLI `archmantic skill [suggest|list|show|add]`; a web Skills facet.

Full design: **`docs/design/SKILLS.md`**.

---

## 8.6 Other shipped capabilities (analysis + substrate)

These extend the pipeline (§3) and the IR (§2); each keeps the model-first/provenance framing.

| Capability | What it does | Where |
|---|---|---|
| **API surface** | Detects REST routes, tRPC procedures, GraphQL fields (incl. NestJS, Laravel) → `Endpoint` IR; projected as the contract + `get_api_surface` | analyze pipeline (Tier 1) |
| **Data model / ERD** | Reads Prisma/Drizzle/SQL/Laravel schemas → `DataEntity`/`DataField` with PK/FK/unique/relations; projects to an ERD + `get_data_model` | analyze pipeline (Tier 1) |
| **Schema drift** | Diffs the migration-derived entities vs the live DB (introspected), presence-only by design to avoid false positives | `src/drift/schema-drift.ts` |
| **Architecture diff + history** | Reconstructs the IR at past commits (non-destructive git-archive) and diffs consecutive versions → a per-commit record of how the architecture changed | `src/diff/` (`model-diff`, `history`, `snapshot`) |
| **Multi-repo system view** | Aggregates per-repo models (each declares `system` + `consumes` in `.archmantic/config.json`) into one cross-service context diagram + cross-repo link inference | `src/system.ts`, `suggest_links` |
| **Usage metering** | Records each read tool call's returned/saved tokens to a durable `.archmantic/usage.jsonl` outbox, best-effort flushed to the cloud `/usage` dashboard (idempotent by event id; cloud failures never surface to the agent) | `src/mcp/usage.ts` |
| **Agent hand-off / autonomous build** | Runs the build spec (§9) through Claude Opus 4.8 (BYOK) to produce a concrete, file-level implementation plan a coding agent executes — read-only, it plans, it does not edit the repo | `src/agent.ts` |

---

## 9. How "edit then build" works (Decision #8 — external-agent-first **(confirm)**)

1. User edits a diagram in the web canvas → platform patches the **IR** (not code).
2. Platform computes the **diff between desired IR and current code-derived IR**.
3. Platform emits a **build spec** — a structured, human+agent-readable description of the intended change ("add a `NotificationService` component; `Checkout` should publish `OrderPlaced` to it").
4. **v1:** an external agent (Claude Code / Cursor) consumes that spec (via MCP or a written task) and writes the code. Archmantic stays the brain/context layer.
5. **Later:** Archmantic orchestrates the build itself (Anthropic Managed Agents or a local agent loop) — configurable.

This keeps v1 honest: we prove the model→spec loop without owning code generation.

---

## 10. Risks the architecture must actively manage

| Risk | Mitigation baked into the design |
|---|---|
| **Reverse-engineered diagram is plausible but wrong** | Provenance-on-every-element + confidence scores + escalation; UI shows "grounded in N refs" and flags low-confidence elements; agents see confidence too |
| **Token savings are hand-wavy** | Built-in benchmark harness in the MCP layer (§6) producing a concrete % reduction |
| **LLM cost explodes on big repos** | Tiered pipeline only sends ambiguous regions to Tier 2; Haiku for bulk; caching; incremental updates |
| **Multi-language coverage** | tree-sitter grammars per language; start with 2–3 (see build plan), degrade gracefully (Tier 0–1 still work structurally) |
| **Diagram/IR/code three-way drift** | IR is the single source; diagrams are derived; `report_drift` + re-analysis on change keep IR ≈ code |

---

## 11. Agreed architecture decisions (2026-06-13, reconciled 2026-06-18)

| Topic | Decision |
|---|---|
| **Deployment topology** | **Local-first hybrid.** CLI + MCP + in-repo `.archmantic/` model run locally and free (privacy parity with code-graph rivals); cloud platform adds editing, collaboration, dashboards (paid). |
| **LLM / privacy (Tier 2)** | **BYOK first** — user supplies their own Anthropic API key; analysis runs on their machine/CI and code never leaves their environment on the free/local path. **Managed + configurable (BYOK *or* managed) is the long-term goal** for the cloud tier. |
| **v1 languages (Tier 1)** | **TypeScript/JS only** for v1 — fastest to the differentiated demo, and we dogfood on our own codebase. More grammars (Python, Go, …) post-MVP. |
| **Diagram formats** | **React Flow** graphs (context/components/sequence/ERD) **+ BPMN 2.0** (process, via `bpmn-js`). BPMN is the white-space USP and the standard to align to. (Mermaid removed — see §"Diagram formats".) |
| **Edit-then-build** | External agent in v1 (platform = context/brain layer); platform-orchestrated build later. |
| **Platform stack** | Web app = **Next.js on Vercel**; database = **Neon** (serverless Postgres) + **pgvector** for capability search. Local CLI/MCP stays dependency-light and DB-free (in-repo `.archmantic/`). |
| **Data store (graph vs doc vs relational)** | **Neon Postgres**, used as document + vector + relational: **JSONB** for the evolving IR (MongoDB-style flexibility), **pgvector** for capability semantic search, all in one store. **No MongoDB, no graph DB.** The per-project graph is small → loaded into memory and traversed in app code (TS); the DB persists/indexes, it doesn't do graph compute. Revisit a graph layer (Apache AGE or a dedicated graph DB) only if deep, cross-repo, many-hop traversal becomes a measured bottleneck. |

### Shipped since (decisions now settled in code, through 1.17.0)
| Topic | Decision as shipped |
|---|---|
| **IR storage shape** | **Single canonical doc** — `.archmantic/model.json`, byte-stable (sorted arrays + recursively sorted keys via `serializeModel`) so analyze/incremental/DB-round-trip all produce identical output → churn-free committed IR and clean PR diffs. Sharding not needed at current graph sizes. |
| **Spec layer** | Human-intent layer above structure: project brain → features → BYOK intent compiler → feature-scoped flows (§2.5, `docs/design/SPEC-LAYER.md`). |
| **Skills layer** | Model-resolved playbook catalog (builtin/local/remote), data-only/never-executed, surfaced via MCP/CLI/web (§8.5, `docs/design/SKILLS.md`). |
| **API surface & data model** | First-class IR (`Endpoint`, `DataEntity`); REST/tRPC/GraphQL/NestJS/Laravel + Prisma/Drizzle/SQL/Laravel detection in Tier 1 (§8.6). |
| **Architecture history** | Per-commit IR reconstruction + diff (§8.6) — the first step of the team "cloud knowledge" story. |
| **Usage metering** | Durable local outbox (`usage.jsonl`) → best-effort cloud flush; the proof-of-value substrate (§8.6). |
| **Agent hand-off** | Build spec → Opus 4.8 implementation plan, read-only (§8.6/§9) — the v1 "build" half of edit-then-build. |

### Still open (lower-stakes)
- Process IR depth: `Process.tasks` is flat today; gateways/events/lanes for richer BPMN remain to be filled in.
- Tier 3 (runtime/observability) is still future work.

See `docs/MVP_PLAN.md` for the sequenced build.
