# Spec layer — human-authored intent on top of the structural model

Today Archmantic reverse-engineers a **structural** model (components, endpoints,
entities, capabilities). This adds an **intent/spec layer** authored by humans +
agents and kept live: a project brain, feature definitions, and feature-scoped
behavior flows. Diagrams/MCP/web remain projections of the one model.

Design principles (unchanged): model-first, provenance on every element
(`source: "human"` for authored), repo files are the source of truth (git-versioned,
agent-readable, diffable), web is a projection/editor later.

## Phase 1 — Project manifest + richer knowledge  (ships as 1.8.0)

A human-authored **project brain** committed at `.archmantic/project.json`:

```jsonc
{
  "goal": "One paragraph: what this project is for.",
  "status": "active",                       // active | wip | paused | archived
  "author": { "name": "...", "email": "...", "url": "..." },
  "owners": ["..."],
  "links": [{ "label": "Docs", "url": "..." }],
  "agents": [{ "name": "core-engineer", "role": "...", "file": ".claude/agents/core-engineer.md" }],
  "history": [{ "date": "2026-06-14", "note": "..." }]
}
```

- `agents` auto-seeds from `.claude/agents/*.md` (name + description from frontmatter)
  when not specified, so it reflects the real agent team.
- Merged into `model.manifest` during `analyze` (like `applyConfig`).
- **Knowledge** (`AGENTS.md` + web) leads with goal/author/agents/links — no longer dry.
- **MCP** gains `get_project` (narrative: goal, status, author, agents, history,
  counts); `get_context` mentions the goal.
- **Web** shows a project header (goal + author attribution) and an agents/links panel.
- CLI: `archmantic project [--init]` scaffolds/prints the manifest; `init` seeds it.

## Phase 2 — Feature layer  (1.9.0)

New richer IR type `Feature` (capabilities stay the lightweight auto-derived layer):

```
Feature
  id, name, description
  shows:    [{ what, source? }]     // UI/things shown (e.g. "hero slider (from admin)")
  actions:  [{ name, description }] // user actions
  dependsOn: [featureId]            // e.g. Home → Login, Vendors
  components: [componentId]         // grounding to code (optional)
  provenance: human | code
```

- Authored as repo files: `.archmantic/features/<slug>.md` (frontmatter + sections
  `## Shows` / `## Actions` / `## Depends on`), git-versioned and agent-editable.
- **Intent compiler** (Tier 2 / BYOK): editing a feature's description (e.g. "Home
  must have a vendors section") → analyze the intent → create/define the `Vendors`
  feature and update `Home.dependsOn`/`shows`, compacting the definitions. A CLI
  command `archmantic feature sync` (and an MCP `define_feature` tool) runs it.
- Bottom-up seed: derive candidate features from routes/pages + capabilities, then
  the human refines (provenance flips human once edited).
- Projections: features list/detail in web; MCP `list_features`/`get_feature`.

## Phase 3 — Feature-scoped behavior flows  (1.10.0)

Sequences become **function-level definitions scoped to a feature** (NOT a global
call graph — that stays deferred):

```
Flow (belongs to a Feature)
  id, name
  steps: [{ actor/componentId, calls: functionRef, description }]
```

- A feature owns one or more named flows; each step references a real function
  (`file:line` provenance) with a human description.
- Sequence diagram projects from a flow; the flow is editable as the source.
- MCP `get_feature_flow`; web renders + links steps to code.

## Deferred (by decision)
- DB hybrid (delta storage / normalized index) — keep JSONB canonical for now;
  only add content-hash dedup + write-time JSON validation as a cheap integrity win.
- Global call-graph / generic function-level tracking (red ocean) — flows are
  feature-scoped instead.
- Web editing of spec files — repo files first; web editor is a later projection.
