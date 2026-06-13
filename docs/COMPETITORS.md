# Archmantic — Competitive Landscape

> Status: **First-pass scan, 2026-06-13.** Built from public info (project READMEs, blogs, comparison articles). Feature cells are best-effort and should be validated hands-on before we rely on them. Sources listed at the bottom.

## TL;DR — the strategic read

The space splits into **two camps that don't overlap**, and Archmantic's wedge is the bridge between them:

1. **Agent code-graph / MCP tools** (CodeGraph, tokensave, code-graph-rag) — give *AI agents* a queryable code graph via MCP to cut tokens. **Machine-only. No human-facing visual model, no business processes, no editing.**
2. **Architecture-diagram tools** (Structurizr, IcePanel, Swark, CodexGraph, GitUML) — give *humans* visual diagrams. **Human-only. No MCP/agent interface; mostly either manual modeling or one-shot diagram generation, not a live queryable model.**

**Archmantic = one provenance-grounded model that serves *both* humans (editable visual architecture, incl. BPMN/capabilities) and agents (MCP), and closes the loop with edit-then-build.** Nobody in either camp does the whole thing.

⚠️ **Reality check:** the "code graph → MCP → fewer tokens" pitch is a **red ocean** — multiple 2026 projects, OSS, local-first, free, with loud claims (35%–120x token cuts). **CodeGraph already markets almost exactly our MVP one-liner.** So token-savings alone is *not* a differentiator; it's table stakes. Archmantic must win on the layers the code-graph crowd ignores: **architecture & business semantics (BPMN, capabilities), human+agent unification, provenance/trust, and the editable model→build loop.**

---

## Direct competitors (closest first)

### 1. CodeGraph — *the closest competitor*
Open-source, local-first code-intelligence library + CLI + **MCP server**. Pre-indexed knowledge graph (symbols, call graphs, imports), **auto-syncs on code change**, ~14–42 MCP tools, 19–38 languages, VS Code extension, persistent memory. Claims ~**70% fewer tool calls / ~35% fewer tokens**. Targets Claude Code, Cursor, Codex, Gemini, etc.
- **Overlap with us:** code → graph → MCP → fewer tokens → auto-update. This *is* our MVP headline.
- **What it lacks (our wedge):** no business-process/BPMN, no capability prose, no human-facing editable diagrams, no provenance/confidence surface, no edit-then-build. It's a symbol/call graph for machines, not an architecture model for humans+agents.

### 2. tokensave
"Most comprehensive code-intelligence MCP server." 40+ tools, 30+ languages, 9 agent integrations, pre-indexed semantic knowledge graphs, 100% local. Same camp as CodeGraph; same gaps.

### 3. code-graph-rag.com / RepoGraph (research)
GraphRAG over codebases for AI analysis; RepoGraph is an academic "repository-level code graph" plug-in for AI SWE. Same machine-graph camp.

### 4. Sourcegraph (+ Cody / Amp)
The incumbent code-intelligence/search platform. Broader and more mature; enterprise code navigation + AI. Not architecture-modeling or BPMN; a potential mover if it pushes into agent-context, so worth watching.

---

## Adjacent — architecture diagram / living-docs tools (human camp)

### 5. Swark (VS Code, OSS)
LLM-generated architecture diagrams from code, integrated with Copilot, Mermaid output, no API key. **One-shot generation, not a live queryable model; no MCP, no BPMN, no edit-then-build.**

### 6. CodexGraph (codexgraph.com)
AI platform that generates system architecture diagrams from source — interactive maps of services/modules/deps. Closer to "living" but human-facing only; no agent/MCP layer; no business processes.

### 7. GitUML
Reverse-engineering **+ manual markup** → class, sequence, state, activity, component diagrams. UML-centric, human-facing; no MCP, no business-process modeling, mix of auto + manual.

### 8. Structurizr
The C4 "diagrams as code" tool — DSL, single model → many views, Git-friendly. **Manual modeling** (you write the DSL), not reverse-engineered; human-only; no MCP.

### 9. IcePanel
Collaborative C4 modeling, drag-and-drop, cloud, good for technical + non-technical. **Manual**, human-only, no reverse-engineering, no agent layer.

### 10. C4InterFlow
Generates C4 diagrams dynamically from an architecture model (keeps them accurate). Model-driven like us, but C4-only, human-facing, no MCP/BPMN/edit-then-build.

> Note: **CodeSee** and **Sourcetrail** appear in older comparisons but both wound down (Sourcetrail open-sourced & archived ~2021; CodeSee scaled back/acquired ~2024) — treat as cautionary precedents, not live competitors.

---

## Feature comparison (first-pass — validate before trusting)

Legend: ✅ yes · ◑ partial/one-shot/manual · ❌ no · — unknown

| Capability | **Archmantic** (planned) | CodeGraph / tokensave | Swark / CodexGraph | Structurizr / IcePanel | GitUML |
|---|:--:|:--:|:--:|:--:|:--:|
| Reverse-engineer from code | ✅ | ✅ | ✅ | ❌ (manual) | ◑ (auto+markup) |
| Auto-update on change | ✅ | ✅ | ❌ | ◑ (Git) | ❌ |
| Context / C4 diagram | ✅ | ❌ | ✅ | ✅ | ◑ |
| Sequence diagrams | ✅ | ❌ | ◑ | ❌ | ✅ |
| **BPMN / business process** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Capability/feature descriptions (prose)** | ✅ | ❌ | ◑ | ◑ | ❌ |
| **Provenance (file:line) + confidence** | ✅ | ◑ (graph refs) | ❌ | ❌ | ◑ |
| **MCP server for agents** | ✅ | ✅ | ❌ | ❌ | ❌ |
| Token-savings focus | ✅ | ✅ | ❌ | ❌ | ❌ |
| Human-facing visual UI | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Editable model (edit diagram = edit model)** | ✅ | ❌ | ❌ | ✅ (DSL/UI) | ◑ |
| **Edit-then-build (model → code spec)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| In-repo, version-controlled | ✅ | ◑ (local DB) | ❌ | ✅ | ❌ |
| Local-first / privacy | ◑ (CLI local; platform optional) | ✅ | ◑ | ◑ | ❌ |

**Columns where only Archmantic is ✅:** BPMN/business process, edit-then-build, and the *combination* of MCP-for-agents **+** human-editable visual model **+** provenance. That trio is the moat.

---

## What this means for the plan

1. **Don't lead the pitch with "fewer tokens."** CodeGraph/tokensave own that messaging and are free/OSS. Lead with **"the living architecture model both your team and your agents share"** — humans see capabilities/processes/diagrams; agents query the same model.
2. **BPMN + capability descriptions are the clearest white space.** The whole field stops at code structure (symbols, calls, classes). Business-process and capability semantics are unclaimed — lean into them.
3. **Provenance/confidence is our trust differentiator** — none of the AI-diagram tools expose "this element is grounded in these N code refs."
4. **Edit-then-build is unclaimed** across both camps — a strong "v2" wedge.
5. **MVP risk:** as written, Milestone 4 (code→graph→MCP→token proof) directly overlaps CodeGraph. Consider pulling a thin slice of the *human-facing editable architecture view* and *one BPMN/capability* into the MVP demo so the very first thing people see is the part competitors don't have. (Decision to discuss.)

## Sources
- CodeGraph — github.com/colbymchenry/codegraph; codegraph-ai/CodeGraph; bighatgroup.com/blog/codegraph-2026-05-26; tosea.ai guide (2026)
- tokensave — github.com/aovestdipaperino/tokensave
- code-graph-rag.com; RepoGraph — arxiv.org/abs/2410.14684
- Swark — github.com/swark-io/swark
- CodexGraph — codexgraph.com
- GitUML — gituml.com
- Structurizr — structurizr.com; IcePanel — icepanel.io (incl. icepanel.io/blog/2025-11-14-icepanel-vs-structurizr)
- C4InterFlow — app.c4interflow.com
- "Towards Living Software Architecture Diagrams" — arxiv.org/abs/2407.17990
