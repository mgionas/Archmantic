# Archmantic — MVP Build Plan (repositioned around white-space USPs)

> Status: **Draft v0.2** — repositioned 2026-06-13 to lead with differentiators competitors lack (see `docs/COMPETITORS.md`). Derived from `docs/CONCEPT.md` + `docs/ARCHITECTURE.md`.

## The repositioning, in one line

> **Don't open with "fewer tokens"** (CodeGraph & co. already own that, free/OSS). Open with **"a living, *trustworthy* architecture model your whole team and your agents share — including the parts code-graph tools can't see: business processes, capabilities, and an editable source of truth."**
> Token-savings via MCP is still in the MVP — but as the *second* proof, not the headline.

---

## Short-term USPs (quick to ship, hard for the code-graph crowd to copy)

Ranked by **(impact × how-early-we-can-ship × how-defensible)**. Each is something neither camp (agent code-graph tools *or* diagram tools) does today.

| # | USP | Why it wins early | Why competitors can't quickly copy |
|---|---|---|---|
| **1** | **Capability map (plain-English "what can this system do?")** | Instant value on any repo; speaks to PMs/architects/new hires, not just engineers | Code-graph tools emit symbols/calls, not capabilities; needs the semantic model, not a call graph |
| **2** | **BPMN / business-process view, auto-detected** | Unclaimed white space — *nobody* auto-generates business processes from code | Requires modeling business semantics, not code structure |
| **3** | **Provenance + confidence ("grounded in N code refs", trust badges)** | Turns "plausible AI diagram" into "verifiable" — the trust differentiator | The whole AI-diagram field ships ungrounded output; retrofitting trust is hard |
| **4** | **Drift detection — "your docs/diagrams vs reality" diff** | Killer first-run hook: point at a repo → "your README architecture is 40% wrong, here's the truth" | Only possible because our model is grounded to code with provenance |
| **5** | **PR architecture diff — "how this PR reshapes your architecture"** | Drops into existing GitHub workflow; visual, shareable, viral; "architecture code review" | No competitor does architecture-level (not line-level) PR diffs |
| **6** | **One model → many audiences** (C4 for architects, BPMN for analysts, capability list for PMs, MCP for agents) | A single artifact serves stakeholders who today use 4 different tools | Each competitor serves exactly one audience |
| **7** | **Human ↔ agent parity** (the diagram you edit *is* the context your agent queries) | "Single source of truth" demo that no one else can show | Code-graph camp has no human UI; diagram camp has no agent/MCP layer |

**Pick for the MVP demo:** USPs **1–4** are the cheapest to reach (they fall out of the grounded model + Tier 0–2 analysis) and are the clearest "competitors don't have this." USP **5 (PR diff)** is the best *growth* hook — fast-follow. USP **7** is the long-term moat (needs editing + MCP, both in/after MVP).

---

## Milestones (re-sequenced so the differentiated demo comes FIRST)

Each milestone is demoable. Accuracy (provenance) and the white-space USPs are front-loaded; the MCP/token-savings proof moves later.

### M0 — Skeleton + provenance-first IR  *(in progress)*
- TS project; **IR schema** with **mandatory provenance + confidence** on every element.
- `archmantic` CLI shell: `init`, `analyze`, `mcp`, `view` (stubs).
- **Demo:** `archmantic init` writes an empty `.archmantic/model.json` with the typed schema.

### M1 — Grounded analysis (Tier 0 + Tier 1)
- Repo walk + manifest parsing (Tier 0) → systems, components, dependency edges.
- tree-sitter static analysis (Tier 1) for **TypeScript/JS only (v1)** → import/call graph, routes, entry points. We dogfood on our own codebase. **Every element carries `file:line` provenance + confidence.**
- **Demo:** run on a sample repo → grounded IR, no LLM yet.

### M2 — **The differentiated first demo** (USPs 1–3)
- Project IR → **context diagram** (Mermaid) + **capability map** (plain-English, USP 1) + **one BPMN process** (USP 2).
- **Trust layer (USP 3):** every diagram element shows "grounded in N refs" + confidence; low-confidence flagged.
- Minimal viewer (`archmantic view` terminal preview + tiny static HTML).
- **Demo (lead with this):** point at a repo → get a *verifiable* capability map + context + a business-process diagram. **This is the part CodeGraph/tokensave/Swark can't show.**

### M3 — **Drift detection + PR architecture diff** (USPs 4–5)
- **Drift (USP 4):** compare committed docs/diagrams (or a prior IR snapshot) against the freshly-derived IR → "X% out of sync, here's what's wrong."
- **PR diff (USP 5):** given a branch/PR, render *what changed in the architecture* (new component, new dependency, new cross-service call).
- **Demo:** the two best growth hooks — instant "your docs are wrong" on any repo, and "architecture code review" on a PR.

### M4 — Tier 2 LLM semantic pass (SA-quality)
- Claude (`@anthropic-ai/sdk`): Haiku for component/capability summaries, Opus 4.8 for flow synthesis; **structured outputs**; **provenance required or rejected**; escalate only low-confidence regions.
- **Demo:** capability descriptions + sequences now read like a senior SA wrote them, every element still traceable, with a visible LLM-cost report.

### M5 — MCP server + token-savings proof (the *second* proof, not the headline)
- `archmantic mcp` exposing read tools (`get_context`, `get_component`, `get_sequence`, `whats_related`, `search_capabilities`) over the IR.
- Benchmark harness: tasks answered via MCP vs raw file reads → token delta.
- **Demo:** "and now your agents query the *same* model — at ~X% fewer tokens." Reinforces, doesn't lead.

### M6 — Incremental update on change
- Git-diff–driven re-analysis → patch IR → re-render only affected diagrams. Git hook / CI snippet.
- **Demo:** edit a file, commit → only affected diagram + capability updates, fast.

---

## After MVP (the long-term moat)
1. Web platform with **editable** diagram canvas (`bpmn-js` + Mermaid) — USP 7 fully realized.
2. **Edit-then-build** loop → emit build spec → external agent implements. *(No competitor in either camp does this — the ultimate differentiator.)*
3. Freemium/subscriptions (editing = paid; small projects free).
4. More language grammars (Go, Java, C#, Ruby, …).
5. Tier-3 runtime/observability ingestion.
6. Platform-orchestrated building (Managed Agents) as a configurable option.

## Agreed (2026-06-13)
- **Topology:** local-first hybrid (free local CLI+MCP+in-repo; paid cloud platform for editing/collab).
- **LLM/privacy:** BYOK first (code stays local), managed+configurable later.
- **Languages for v1:** **TypeScript/JS only** — dogfood on our own codebase.
- **Diagram formats:** Mermaid (context/sequence) + BPMN 2.0 (process).
- **Sample dogfood repo:** the Archmantic codebase itself (this repo) as we build it.
