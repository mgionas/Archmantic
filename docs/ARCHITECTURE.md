# Archmantic — Technical Architecture

> Status: **Design v0.1** — derived from `docs/CONCEPT.md`. Last updated: 2026-06-13.
> This describes *how* we build the platform. Recommendations are decisive; anything marked **(confirm)** is a judgment call worth a second look before we commit code.

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

A versioned graph. Conceptual shape (not final schema):

| Element | Examples | Key fields |
|---|---|---|
| **System** | the project itself, external systems | id, name, kind, description |
| **Component** | service, module, package, layer | id, name, responsibility, **provenance[]** |
| **Actor** | user role, external system, scheduler | id, name, kind |
| **Relation** | calls, depends-on, publishes-to, reads | from, to, kind, **provenance[]** |
| **Flow** | a sequence (checkout, login) | ordered steps, participants, **provenance[]** |
| **Process** | a business process (BPMN) | tasks, gateways, events, lanes |
| **Capability** | a feature/capability description | id, title, prose, linked components |

Every element and relation carries:
- `provenance[]` — list of `{source, ref, confidence}` (e.g. `{code, "src/pay/charge.ts:42", 0.9}`). **No element without provenance** (except user-authored edits, tagged `source: human`).
- `confidence` — drives the "is this trustworthy?" surface and the tiered escalation (low confidence → escalate to a deeper, costlier analysis tier).

Stored as **diffable text** (one canonical JSON/YAML doc per project, or sharded per subsystem) so it version-controls cleanly in the repo.

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

The MCP server is how agents consume (and the token-savings story). It exposes **structured tools over the IR**, not raw files:

**Read tools (agent ← Archmantic):**
- `get_context` — system context + components (compact)
- `get_component(name)` — one component's responsibility, relations, provenance
- `get_sequence(flow)` / `list_flows`
- `get_process(name)` (BPMN)
- `search_capabilities(query)` — semantic search over capability descriptions
- `whats_related(element)` — graph neighborhood (this is the big token-saver: "what touches checkout?" returns 200 tokens instead of 20 files)

**Write/feedback tools (agent → Archmantic):**
- `propose_change(diagram_edit)` — agent edits the model (feeds the "edit then build" loop)
- `report_drift(observation)` — agent flags model/reality mismatch it noticed while coding

Built on the official MCP TypeScript SDK; ships as a process the user's existing agent (Claude Code, Cursor) points at — satisfying "plug in first" (Decision #9).

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

## 11. Agreed architecture decisions (2026-06-13)

| Topic | Decision |
|---|---|
| **Deployment topology** | **Local-first hybrid.** CLI + MCP + in-repo `.archmantic/` model run locally and free (privacy parity with code-graph rivals); cloud platform adds editing, collaboration, dashboards (paid). |
| **LLM / privacy (Tier 2)** | **BYOK first** — user supplies their own Anthropic API key; analysis runs on their machine/CI and code never leaves their environment on the free/local path. **Managed + configurable (BYOK *or* managed) is the long-term goal** for the cloud tier. |
| **v1 languages (Tier 1)** | **TypeScript/JS only** for v1 — fastest to the differentiated demo, and we dogfood on our own codebase. More grammars (Python, Go, …) post-MVP. |
| **Diagram formats** | **React Flow** graphs (context/components/sequence/ERD) **+ BPMN 2.0** (process, via `bpmn-js`). BPMN is the white-space USP and the standard to align to. (Mermaid removed — see §"Diagram formats".) |
| **Edit-then-build** | External agent in v1 (platform = context/brain layer); platform-orchestrated build later. |
| **Platform stack** | Web app = **Next.js on Vercel**; database = **Neon** (serverless Postgres) + **pgvector** for capability search. Local CLI/MCP stays dependency-light and DB-free (in-repo `.archmantic/`). |
| **Data store (graph vs doc vs relational)** | **Neon Postgres**, used as document + vector + relational: **JSONB** for the evolving IR (MongoDB-style flexibility), **pgvector** for capability semantic search, all in one store. **No MongoDB, no graph DB.** The per-project graph is small → loaded into memory and traversed in app code (TS); the DB persists/indexes, it doesn't do graph compute. Revisit a graph layer (Apache AGE or a dedicated graph DB) only if deep, cross-repo, many-hop traversal becomes a measured bottleneck. |

### Still open (lower-stakes, can decide during build)
- IR storage shape: single doc vs sharded-per-subsystem (affects diff granularity).

See `docs/MVP_PLAN.md` for the sequenced build.
