# Archmantic

**A living, *trustworthy* architecture model your whole team — and your AI agents — share.**

Point Archmantic at a repo and it reverse-engineers a single grounded **architecture model** (the IR). Every diagram is a *projection* of that one model, every element is traceable to `file:line`, and the same model answers your agent's questions over MCP. No drift between views, no ungrounded "AI diagram" guesswork.

> Status: **v1.0.0** — published as [`@archmantic/cli`](https://www.npmjs.com/package/@archmantic/cli). Dependency-light TypeScript CLI, dogfooded on this repo. Node 24 LTS · TypeScript 6 · NodeNext.

---

## Why it's different

Most tools pick one camp: agent code-graph tools emit symbols/calls (no human view, no business semantics), and diagram tools draw pretty pictures you can't trust or query. Archmantic does the parts both camps miss:

- **Capability map** — plain-English "what can this system do?", for PMs/architects/new hires, not just engineers.
- **BPMN business-process view** — auto-detected from code. White space nobody else occupies.
- **Provenance + confidence** — every element shows "grounded in N refs" and a confidence band; low-confidence is flagged. Verifiable, not plausible.
- **Drift detection** — "your committed model vs. the code" diff.
- **PR architecture diff** — how a change reshapes the architecture (not a line diff), postable as a PR comment.
- **Architecture history** — how the system's shape evolved, commit by commit.
- **Data model (ERD)** — entities, fields, and relations parsed from your Prisma schema, Drizzle tables, or SQL `CREATE TABLE` migrations, grounded to `file:line` and projected as a Mermaid ERD.
- **API surface** — REST routes (Next.js App Router/Pages, Express/Fastify/Koa/Hono), tRPC procedures, and GraphQL operations, grounded to `file:line` — the contract layer for humans and agents.
- **Multi-repo auto-linking** — across an org's repos, classifies cross-service links as connected, **inferred** (detected coupling not yet declared), or **dangling** (declared dependency on a repo that isn't there — a real gap).
- **One model → many audiences** — C4-style context, components, sequence (Mermaid), BPMN, an ERD, capability list, and an MCP surface for agents.
- **Token savings** — agents query the model over MCP instead of reading whole files (~98% fewer tokens on this repo, by the built-in benchmark).
- **Usage stats** — every MCP tool call is recorded with the tokens it saved; `archmantic usage` and the web `/usage` dashboard prove the model is earning its keep (and meter agent activity).

## Quickstart

No install needed — run it straight from npm:

```bash
npx @archmantic/cli analyze     # reverse-engineer the model → .archmantic/model.json
npx @archmantic/cli view        # capability map + diagrams + trust report → .archmantic/view.html
npx @archmantic/cli bench       # token-savings benchmark (MCP vs raw file reads)
```

Or install the CLI globally (the command is `archmantic`):

```bash
npm install -g @archmantic/cli
archmantic analyze
```

**From source** (for contributors):

```bash
npm install && npm run build
node dist/cli.js analyze
```

## Commands

| Command | What it does |
|---|---|
| `init [name]` | Create an empty `.archmantic/model.json` |
| `analyze [--tier N]` | Reverse-engineer the model. `--tier 2` adds the LLM semantic pass (BYOK) |
| `update [--hook]` | Incrementally re-analyze only what changed (git-diff driven). `--hook` prints a pre-commit hook |
| `view` | Capability map, diagrams, and trust report; writes a self-contained `view.html` |
| `spec` | Emit an agent-ready **build spec** (`build-spec.md` + `.json`) from the model |
| `apply [--from f]` | Merge a human BPMN canvas edit back into the model — the "edit" of edit-then-build (fetches your saved cloud edit via token, or a local `.bpmn`) |
| `handoff [--apply] [--check "<cmd>"]` | Run the build spec through Claude (Opus 4.8, BYOK) → an implementation plan; **`--apply`** runs an autonomous agent loop that edits the repo **and self-verifies** (runs build + tests, fixes failures until green) — the "build" of edit-then-build. Commit first; review with `git diff`. |
| `drift [--check]` | Compare the committed model vs. the code; `--check` exits 1 on drift (CI gate) |
| `diff [<ref>]` | Architecture diff from a git ref → working tree; writes PR-comment-ready `pr-diff.md` |
| `log [-n N]` | Architecture history: how the architecture changed per commit |
| `system [name] --repos a,b,c` | Unified cross-service view across multiple repos (microservices / split front-back). Declare links per repo in `.archmantic/config.json` → `{ "system": "...", "consumes": ["other-service"] }` |
| `mcp` | Start the MCP server exposing the model to AI agents (stdio) |
| `bench [--exact]` | Token-savings benchmark; `--exact` uses the Anthropic token counter (BYOK) |
| `usage [--sync]` | MCP usage + token savings from the local log; `--sync` pushes it to the team cloud (web `/usage`) |

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

This repo ships a project [`.mcp.json`](.mcp.json). In Claude Code / Cursor, approve the **archmantic** server, then your agent can:

- **Read** the model: `get_context`, `search_capabilities`, `get_component`, `get_process`, `whats_related`, `list_components`, `get_sequence`.
- **Keep it live:** `refresh` (re-analyze from disk after a change) and `sync` (re-analyze **and push to the team cloud**, org-scoped). So when you ask the agent to change something, it can update the shared architecture model in the same flow — no manual `push`.

The MCP server reads credentials from `.env.local` (so `sync` uses your `ARCHMANTIC_TOKEN`). For fully hands-free syncing, add a Claude Code **Stop hook** that runs `archmantic update && archmantic push` after each turn.

## Team cloud knowledge (shared model)

Share the architecture model across a team. `push`/`pull`/`cloud-log` work in **two modes**:

```bash
node dist/cli.js push       # upload the model under the current commit
node dist/cli.js pull       # fetch the team's latest shared model into .archmantic/
node dist/cli.js cloud-log  # list the per-commit snapshots in the cloud (direct mode)
```

| Mode | Auth | For |
|---|---|---|
| **Self-host (free)** | `DATABASE_URL` in `.env.local` — writes Neon directly | OSS users / your own infra |
| **Managed SaaS** | `ARCHMANTIC_TOKEN` (+ `ARCHMANTIC_API_URL`) — pushes through the platform's authenticated, **org-scoped** API | teams / customers |

Mint a SaaS token from the web app's **Settings** page (signed in, in your org); it tags every push with your organization, so customers never hold the raw database URL. The committed `.archmantic/model.json` stays the source of truth; the cloud holds a **per-commit history** powering the team timeline and the web viewer.

## CI: architecture diff on every PR

A reusable GitHub Action comments on each PR with the **architecture-level** delta — new/removed components, capabilities, data-model entities, and external systems — not a line diff. It posts a single sticky comment and updates it on every push.

```yaml
# .github/workflows/architecture-diff.yml
name: Architecture diff
on: pull_request
permissions:
  contents: read
  pull-requests: write
jobs:
  diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # so the base ref can be analyzed
      - uses: mgionas/Archmantic@v1 # the reusable action (action.yml)
```

Inputs: `base-ref` (default: the PR base branch), `working-directory` (default `.`), `version` (default `latest`), `comment` (default `true`), `github-token` (default `${{ github.token }}`). It runs `archmantic diff` under the hood, so no install step is needed.

## Tier 2 (LLM) & credentials

The LLM pass (`analyze --tier 2`) and `bench --exact` are **BYOK** and gated. Authenticate either way:

- **API key** — set `ANTHROPIC_API_KEY` in `.env.local` (gitignored), or
- **CLI login (OAuth)** — `ant auth login` (the Anthropic CLI); Archmantic picks up the session token automatically.

Without a credential, those paths skip gracefully and everything else runs fully offline.

## Web platform (`web/`)

A read-only architecture viewer over the shared Neon store — Next.js (App Router), deployable to Vercel.

```bash
cd web
npm install
echo 'DATABASE_URL="<your Neon URL>"' > .env.local   # same URL as the CLI
npm run dev        # http://localhost:3000 — project list + capability map + trust
```

Deploy: import `web/` as the Vercel project root and set `DATABASE_URL` as an environment variable. Pages are server-rendered on demand (no build-time DB access).

## Roadmap

The team **cloud knowledge** layer is taking shape: shared model across a team (`push`/`pull`), the CI architecture-diff bot ([already included](.github/workflows/architecture-diff.yml)), and the web platform above. Next: diagram rendering (Mermaid/BPMN) in the web viewer, an editable `bpmn-js` canvas, auth/multi-tenant, and the edit-then-build loop.

See [`docs/MVP_PLAN.md`](docs/MVP_PLAN.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and [`docs/CONCEPT.md`](docs/CONCEPT.md).

## License & model

Archmantic is **open-SaaS**:

- The **CLI & engine** (`/src`) are **Apache-2.0** ([`LICENSE`](LICENSE)) — free, local-first, your code never leaves your machine.
- The **web platform** (`/web`) is **AGPL-3.0** ([`web/LICENSE`](web/LICENSE)) — source-available.
- **Free** includes the full CLI + MCP + self-host (BYO database) + BYOK AI, and managed cloud for **up to 3 seats**.
- Paid: **Team** (per seat), **Managed AI** (metered — no-BYOK Tier-2 / `handoff` / autonomous build), **Enterprise** (SSO/RBAC/audit/on-prem/SLA).

Full business model: [`docs/STRATEGY.md`](docs/STRATEGY.md).
