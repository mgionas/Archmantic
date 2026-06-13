# Archmantic

**A living, *trustworthy* architecture model your whole team — and your AI agents — share.**

Point Archmantic at a repo and it reverse-engineers a single grounded **architecture model** (the IR). Every diagram is a *projection* of that one model, every element is traceable to `file:line`, and the same model answers your agent's questions over MCP. No drift between views, no ungrounded "AI diagram" guesswork.

> Status: **MVP complete (M0–M6).** Dependency-light TypeScript CLI, dogfooded on this repo. Node 24 LTS · TypeScript 6 · NodeNext.

---

## Why it's different

Most tools pick one camp: agent code-graph tools emit symbols/calls (no human view, no business semantics), and diagram tools draw pretty pictures you can't trust or query. Archmantic does the parts both camps miss:

- **Capability map** — plain-English "what can this system do?", for PMs/architects/new hires, not just engineers.
- **BPMN business-process view** — auto-detected from code. White space nobody else occupies.
- **Provenance + confidence** — every element shows "grounded in N refs" and a confidence band; low-confidence is flagged. Verifiable, not plausible.
- **Drift detection** — "your committed model vs. the code" diff.
- **PR architecture diff** — how a change reshapes the architecture (not a line diff), postable as a PR comment.
- **Architecture history** — how the system's shape evolved, commit by commit.
- **One model → many audiences** — C4-style context, components, sequence (Mermaid), BPMN, capability list, and an MCP surface for agents.
- **Token savings** — agents query the model over MCP instead of reading whole files (~98% fewer tokens on this repo, by the built-in benchmark).

## Quickstart

```bash
npm install
npm run build

node dist/cli.js analyze     # reverse-engineer the model → .archmantic/model.json
node dist/cli.js view        # capability map + diagrams + trust report → .archmantic/view.html
node dist/cli.js bench       # token-savings benchmark (MCP vs raw file reads)
```

Optionally link a global `archmantic` binary: `npm link`.

## Commands

| Command | What it does |
|---|---|
| `init [name]` | Create an empty `.archmantic/model.json` |
| `analyze [--tier N]` | Reverse-engineer the model. `--tier 2` adds the LLM semantic pass (BYOK) |
| `update [--hook]` | Incrementally re-analyze only what changed (git-diff driven). `--hook` prints a pre-commit hook |
| `view` | Capability map, diagrams, and trust report; writes a self-contained `view.html` |
| `drift [--check]` | Compare the committed model vs. the code; `--check` exits 1 on drift (CI gate) |
| `diff [<ref>]` | Architecture diff from a git ref → working tree; writes PR-comment-ready `pr-diff.md` |
| `log [-n N]` | Architecture history: how the architecture changed per commit |
| `mcp` | Start the MCP server exposing the model to AI agents (stdio) |
| `bench [--exact]` | Token-savings benchmark; `--exact` uses the Anthropic token counter (BYOK) |

## How it works

**Model-first.** Archmantic builds a canonical [Architecture Model (IR)](docs/ARCHITECTURE.md); diagrams and the MCP API are projections of it — so the views never drift apart.

**Tiered analysis, cheapest-first:**

| Tier | What | Cost |
|---|---|---|
| 0 | Repo structure & manifests → systems, components | free |
| 1 | TS/JS static analysis (TypeScript compiler API) → import/dependency graph | cheap, deterministic |
| 1.5 | Structural derivation → capabilities (exports), one process/flow (entry-point chain) | deterministic |
| 2 | LLM semantic pass — Haiku for summaries, Opus for flow synthesis | metered tokens, opt-in (BYOK) |

**Provenance invariant:** every derived element carries `provenance` (`file:line`) and `confidence`. The LLM pass only *refines prose and raises confidence* on already-grounded elements — it never invents structure. Nothing ungrounded gets in.

## Use it with your AI agent (MCP)

This repo ships a project [`.mcp.json`](.mcp.json). In Claude Code / Cursor, approve the **archmantic** server, then your agent can call `get_context`, `search_capabilities`, `get_component`, `get_process`, `whats_related`, and more — querying the same model your team reads.

## Tier 2 (LLM) & credentials

The LLM pass (`analyze --tier 2`) and `bench --exact` are **BYOK** and gated. Authenticate either way:

- **API key** — set `ANTHROPIC_API_KEY` in `.env.local` (gitignored), or
- **CLI login (OAuth)** — `ant auth login` (the Anthropic CLI); Archmantic picks up the session token automatically.

Without a credential, those paths skip gracefully and everything else runs fully offline.

## Roadmap

The team **cloud knowledge** layer: shared model across a team, the CI architecture-diff bot ([already included](.github/workflows/architecture-diff.yml)), and a web platform (Next.js + Neon) with an editable `bpmn-js` canvas and the edit-then-build loop.

See [`docs/MVP_PLAN.md`](docs/MVP_PLAN.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and [`docs/CONCEPT.md`](docs/CONCEPT.md).
