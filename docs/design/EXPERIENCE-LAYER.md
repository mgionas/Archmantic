# Archmantic — The Experience Layer: Collect → Curate → Present

> Design concept, 2026-06-18. The next major evolution of the product surface.
> Supersedes the "diagrams are direct projections of the import graph" model.
> Pairs with [ARCHITECTURE.md](../ARCHITECTURE.md), [SPEC-LAYER.md](./SPEC-LAYER.md),
> [SKILLS.md](./SKILLS.md), and the forward plan in [../ROADMAP.md](../ROADMAP.md).

## 1. The problem (it's the concept, not just the CSS)

Today every diagram is a mechanical projection of the **raw import graph**: one node
per file, one edge per import — and *every* bare import (incl. `lucide-react`,
`node:fs`) becomes an "external system." So:

- **Context** = one internal blob fanned out to npm packages. Nonsense.
- **Components** = a folder-structure hairball wired to `/external`.
- **Sequence** = import edges relabeled "calls" → "CheckoutPage calls lucide-react." Nonsense.
- **Process/BPMN** = the same import chain a third time, as a one-line node string.
- **Capabilities** = `humanize(exportName)` for every export. Dry symbol dump.

The ERD is the *only* good view — precisely because it projects **meaning** (entities,
typed relations, cardinality), not imports. That is the whole lesson.

## 2. The core insight: one model, two audiences, an AI layer between

**Agents** want *semantic structure*: the grounded graph, provenance, machine-readable
slices. They can handle volume and structure — that's their native form.

**Humans** want *context, clarity, and a story*: "what is this system, what are its
main parts, how does this feature work, what will I break." A raw graph is not that.

So the pipeline is three layers, not one:

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │ 1. COLLECT (deterministic, grounded, cheap, always-on)               │
  │    Reverse-engineer EVERYTHING with file:line provenance.            │
  │    The substrate of truth. Byte-stable. Serves agents directly.      │
  └───────────────────────────────┬─────────────────────────────────────┘
                                   ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │ 2. CURATE (AI, incremental, cached, grounded)                        │
  │    AI reads the full grounded model and CLEANS IT FOR HUMANS:        │
  │    discovers & names domains, writes plain-language descriptions,    │
  │    sorts logically, and produces the project's "positioning" —       │
  │    what it is and how it's shaped. Never invents structure;          │
  │    every claim carries llm provenance over grounded elements.        │
  └───────────────────────────────┬─────────────────────────────────────┘
                                   ▼
  ┌──────────────────────────────┴──────────────────────────────────────┐
  │ 3. PRESENT (per audience)                                            │
  │    Humans → curated, visual, narrated views (Architecture Map,       │
  │             domain cards, feature journeys, rendered knowledge).     │
  │    Agents → the grounded model + curated summaries over MCP.         │
  └─────────────────────────────────────────────────────────────────────┘
```

The deterministic layer stops trying to *be* the human view. It grounds; AI curates;
each audience gets the form it needs. "First it takes some tokens — but at the end of
the day this is what we're building, for humans and AI."

## 3. Layer 1 — Collect (deterministic substrate)

Keep the file graph as the **truth**, but fix what it *means* so both the AI and the
fallback heuristics have clean inputs. (Detail: the IR/analysis design below.)

- **Classify externals.** Libraries are **Technologies, never Systems.** Only
  SaaS / datastore / infra / sibling-services are external `System`s. This single
  change de-noises context, components, sequence, and the system view at once —
  `lucide-react`/`node:fs` leave the graph (kept behind a toggle, still grounded).
  *(Decision to record: libraries are `Technology`, not `System`.)*
- **Raw groups (cheap fallback).** Deterministic clusters from folder + role + package
  (monorepo). This is the cold-start / no-credential view and the scaffold the AI
  curates. Not the final human grouping — the floor, not the ceiling.
- **Everything else stays** (components, relations, endpoints, entities, features) — the
  full grounded collection, with provenance.

## 4. Layer 2 — Curate (the AI human-comprehension layer)

The new heart of the product. An **incremental, cached, grounded** LLM pass that turns
the raw semantic collection into something a human onboards on. It does five things:

1. **Domain discovery & naming.** Cluster components into meaningful domains and name
   them in product language ("Payments", "Identity", "Notifications") — merging/splitting
   beyond what folders reveal. Falls back to deterministic groups when no credential.
2. **Plain-language descriptions.** For domains, key components, features, and external
   dependencies — "what this is and why it exists," not `humanize(symbolName)`.
3. **Logical organization & ranking.** Decide what's core vs. peripheral (entry points,
   hub modules, the spine) so views lead with what matters instead of alphabetic noise.
4. **Project positioning / understanding.** A generated "what this system is, what it
   does, how it's shaped, its main flows" — the onboarding narrative and the answer to
   "explain this repo to me." This is the headline human artifact.
5. **The Architecture Map structure.** Propose the L1/L2 container map (which domains,
   how they relate, the story) grounded in the deterministic graph.

**Principles that keep it cheap and trustworthy:**

- **Grounded, never fabricated.** AI *names, describes, organizes* — it does not invent
  components, edges, or entities. Every curated artifact carries `source: "llm:<model>"`
  provenance over already-grounded elements. The trust surface gains an "AI-curated" band
  so humans/agents see what's structural vs. curated.
- **Incremental.** Re-curate only what the architecture diff says changed (a new domain,
  a changed feature) — not the whole repo every time. The per-commit history is the
  cursor.
- **The user's own agent runs it (decided 2026-06-18).** Archmantic is an MCP tool — the
  user already has an agent (Claude Code, Cursor, …). Curation is **driven by that agent
  over MCP, on the user's own tokens**: the agent reads the grounded map (`get_architecture_map`),
  writes back domain names / descriptions / the positioning narrative (`curate`), grounded
  with `source: "llm:<model>"`. We don't run or meter an LLM, so **monetization defers** (the
  web is a viewer/store; charging for the user's own token spend makes no sense). A **BYOK CLI
  `curate`** is the "run it for me" fallback for users without an agent in the loop.
- **Persistence: committed, merges into `model.json`.** Curation is authored data
  (`.archmantic/curation.json`, agent- or human-written) **merged into the model on analyze**
  (like the manifest/features) so it survives re-derivation, stays diffable/in-PRs, and the
  model carries it. Cloud is a cache/projection of the committed truth.
- **Incremental, out of respect for the agent's budget.** Re-curate only what the
  architecture diff says changed (a new/renamed domain, a changed feature) — never the whole
  repo. The per-commit history is the cursor. Deterministic groups/descriptions are the
  always-free floor when no agent curates.

## 5. Layer 3 — Present (the redesigned surface)

Diagrams stop being a *destination*; they become **zoom levels and on-demand views inside
the facet that owns the question.** Facet sprawl collapses ~13 → ~8.

### The spine: one map, four zoom levels (auto-derived C4)

```
L1  SYSTEM LANDSCAPE (multi-repo)  → services + real call/consume edges        [microservices]
       drill a service ↓
L2  ARCHITECTURE MAP (one repo)    → AI-named domains as containers, not files  [onboarding]
       drill a domain ↓
L3  COMPONENT GRAPH (one domain)   → components in that domain + edges          [understand/impact]
       click a component →
L4  COMPONENT DETAIL               → role, responsibility, dependsOn/usedBy,
                                      exports, endpoints, entities, file:line   [impact analysis]
```

### Facet decisions (keep / merge / drop / rework)

| Facet | Verdict | Becomes |
|---|---|---|
| **Overview** | keep + promote | Lands the AI **positioning narrative** + trust + stack + a Map thumbnail. |
| **Architecture Map** | **NEW hero** | AI-curated domain/container map; the front door (L1/L2). |
| Diagrams → Context | rework | C4 context: internal system ↔ **classified** externals (libs collapsed). |
| Diagrams → Components | merge into Map drill (L3) | Clustered by domain, libraries collapsed, focus+context. |
| Diagrams → Sequence | move into Features, on-demand | A behavior trace **only** for a chosen feature/endpoint. |
| Diagrams → Process/BPMN | rework | **Feature journeys** (user/system swimlanes); keep editable BPMN only when human-authored; no auto one-liner. |
| Diagrams → ERD | keep, promote | Headline of **Data** (the quality bar). |
| **Diagrams (as a tab)** | **drop** | Diagrams live with their questions, not in a destination tab. |
| **Capabilities** | **drop as a facet** | Folds into component detail + the AI domain descriptions. |
| Features | keep + extend | Cards **and** a feature-MAP (feature→deps→components→data); opens the behavior trace. |
| Components | keep | Searchable index + the L3/L4 drill target; **Impact** (usedBy) promoted. |
| Data | keep | ERD + entities. |
| API | keep | Fine as-is (grouped contract table). |
| Skills | keep | Loved; the human+agent differentiator. |
| Changes | keep + feed | Architecture **timeline** (per-commit deltas) + better empty state. |
| **Knowledge** | drop as facet | Render the markdown + fold into Overview as "Agent context." |

Net nav: **Overview · Map · Features · Components · Data · API · Skills · Changes** (+ System for multi-repo). Knowledge folded; Capabilities/Diagrams retired.

### Microservices / system (first-class)
The L1 landscape: services as containers (each drillable to its own Map), edges encoded
by link status (connected / inferred / **dangling** = declared-but-missing → architectural
drift), shared externals drawn once. A true C4 ladder across repos.

## 6. IR & analysis changes that power this (schema 0.1.0 → 0.2.0)

Additive where possible; one expected one-time churn (libraries leave the System set).

- **`Group { kind: layer|domain|area|package, members[], parentId?, order? }`** + a
  `Component.groupId`. Derived deterministically (folder/role/package); **AI curates the
  name/description and may merge/split** (llm provenance, confidence raised).
- **`System.externalKind?: saas|service|infra|datastore`** + new relation kind
  `uses_library`; libraries re-mint as `tech:*`, demoted out of the graph (toggle to show).
- **`FlowStep.kind: request|invoke|query|mutate|external|respond`** + `Flow.trigger`
  (endpoint|actor|schedule). Flows are **rebuilt from layer-crossing behavior**, scoped to
  features/endpoints — not import BFS. Tier-1 skeleton (boundaries) → Tier-2 sharpens to
  real call sites.
- **`Process.featureId? + lanes[]`** — processes become feature journeys; drop the
  import-chain process.
- **Curation fields** — domain/component/feature `description` and the model-level
  **positioning narrative** carry `source: "llm:<model>"` provenance; an "AI-curated" trust
  band distinguishes them. Cached on the snapshot.
- **MCP** — `get_architecture_map` (curated L2 containers + edges) and classified
  `get_context`; agents get the curated summaries too.

## 7. Phased plan

| Phase | Theme | Content | Why this order |
|---|---|---|---|
| **A** | de-noise substrate | Classify externals (libs ≠ systems); deterministic groups; IR `Group`/`externalKind`; schema 0.2.0 | Cheapest change, dissolves ~6 complaints immediately, no AI needed |
| **B** | present (visual win) | Architecture Map hero; Context/Components rework; retire Diagrams-as-tab; rendered Knowledge; Changes timeline; facet consolidation | Turns the substrate fix into the human-visible win |
| **C** | behavior | Rebuild flows (semantic, feature-scoped); sequence on-demand; feature journeys; drop auto-BPMN | Fixes sequence/process honestly |
| **D** | **AI curation layer (agent-driven)** | `get_architecture_map` (read) + `curate` (write) MCP tools so the user's agent names domains / writes descriptions / the positioning narrative on its own tokens, merged into the model via `.archmantic/curation.json`; BYOK CLI `curate` fallback | The "AI cleans for humans" vision — on the user's agent, no managed LLM |
| **E** | system + impact | Microservices landscape (link-status, drill-to-map); impact/blast-radius; ties to breaking-change detection | Builds on groups + curation; the complex-system story |

A is deterministic and immediate; D is where the founder's "AI cleans for humans" vision
lands. B/C can proceed alongside D's groundwork.

## 8. Decisions (2026-06-18)
- **Storage = committed, merged into `model.json`.** Authored in `.archmantic/curation.json`
  (agent/human), merged on analyze like the manifest/features → the model carries it,
  versioned and diffable. Cloud is a cache.
- **Who runs it = the user's own agent over MCP, on their tokens** (`get_architecture_map`
  → `curate`); BYOK CLI `curate` as the fallback. **No managed LLM, no metering — monetization
  deferred.** We don't charge for the user's own token spend; the web is a viewer/store.
- **Cadence = on-demand + incremental.** Re-curate only what the diff changed; deterministic
  groups are the always-free floor.
