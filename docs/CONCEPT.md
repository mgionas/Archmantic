# Archmantic — Concept & Knowledge Base

> Status: **Discovery / knowledge-building** (pre-technical). Last updated: 2026-06-13.
> This is the shared source of truth for *what we're building and why*, before any architecture or code decisions.

---

## 1. One-liner

An **always-on Solution Architect for software projects** — it keeps a living, accurate, visual model of any system's architecture, and serves that model to **both humans (to understand)** and **AI agents (to build accurately with fewer tokens)**.

## 2. The problem

When AI agents (and humans) build and modify software, **nobody holds an accurate, current picture of the whole system**. Agents re-ingest large amounts of code to get context — expensive in tokens and error-prone — and the system drifts: features duplicate, intent is lost, and humans can't see what the system actually does. There's no "SA in the room" keeping a faithful map.

## 3. The idea

A platform that maintains, **per project**, a set of living architecture artifacts:

- **Context diagrams** (system & its boundaries / external actors)
- **Sequence diagrams** (how flows execute across components)
- **BPMN / process diagrams** (business processes & workflows)
- **Written descriptions** of features and capabilities

These artifacts are:
- **Auto-generated** from existing projects (reverse-engineered) and **maintained as the project evolves** (version-controlled, auto-updated on change).
- **Dual-audience**: rendered visually for humans; exposed in machine-readable form to agents **via MCP**.
- **Editable**: users can change the architecture *on the platform first, then build* — making the model a source of *intent*, not just a mirror.

## 4. Who it's for

Anyone using AI to build or maintain software, across skill levels:
- **Solution Architects** — visualize & govern existing systems' features/capabilities.
- **Developers** — keep architecture honest and queryable.
- **"Vibe coders" / non-experts** — get structure and an accurate map without doing the modeling themselves.
- **Agentic frameworks** — consume context via MCP to improve answer quality and reduce token usage.

## 5. Core value props

1. **Faithful, living architecture** — humans always see what the system *actually* is.
2. **Token efficiency + quality for agents** — query precise context via MCP instead of ingesting whole codebases.
3. **Design-first loop** — edit the model, then build to match.

---

## 6. Key decisions made so far

| # | Topic | Decision |
|---|-------|----------|
| 1 | **Reverse-engineer existing projects** | Yes. Use **all available data**, but **tiered by token cost** — start with the cheapest source (repo structure/metadata), escalate to deeper analysis (code parsing, runtime/traces) **only if the cheaper step is insufficient**. Stop as soon as it's "enough." |
| 2 | **New projects** | Build artifacts and update them as the user/agent requests changes. |
| 3 | **Diagram format** | Not finalized. Requirement: **human-visual + agent-readable + diffable + renderable + aligned to existing standards**. (Mermaid / PlantUML / BPMN 2.0 are leading candidates — Claude to choose.) |
| 4 | **UI** | Modern, **minimalistic**, **editable** — change schemas on the platform, then build. |
| 5 | **Artifact storage** | **Both**: committed in the repo (versioned, travels with project) **and** indexed/served by the platform. |
| 6 | **MCP direction** | **Both** — platform exposes artifacts *to* agents AND can pull info *from* the agentic framework. |
| 7 | **Who builds the system** | **Both** humans and agents. |
| 8 | **"Edit then build"** | *(Assumption pending confirmation)* **Configurable**: in v1 an **external agent** (Claude Code / Cursor / etc.) does the building — platform is the **context/brain layer**; **platform-orchestrated building** is a later option. |
| 9 | **Relationship to existing agents** | **Both** — plug into existing tools (Claude Code, Cursor) first; option to replace later. |
| 10 | **Change-detection / steady state** | **Version control + automatic update after change.** |
| 11 | **Form factor** | **Primary: web platform** (manage projects, edit schemas). **Secondary: CLI** for advanced users — explore feasibility of **viewing diagrams directly in the terminal**. |
| 12 | **Business model** | **Freemium**: small projects free; **editing capabilities are subscription-based**. |

---

## 7. MVP (v1) — the irreducible first slice

> Point it at a repo → it reverse-engineers an accurate **context + sequence + BPMN** diagram set → exposes them via an **MCP server** → an agent answers questions using them with **measurably fewer tokens**.

Explicitly **out of v1**: visual editing, the build loop, subscriptions/billing, platform-orchestrated agents. These come after the core "wow" is proven.

---

## 8. Open questions / to pressure-test next

- **Accuracy & trust**: how do we verify a reverse-engineered diagram is *correct*, not plausible-looking? (Biggest risk to credibility.)
- **Build-loop semantics** (decision #8): confirm external-agent-first.
- **Token-savings proof**: how do we *measure* the reduction to make the value prop concrete?
- **Granularity**: per-project vs per-service vs per-feature artifacts.
- **Language/stack coverage** for the code-parsing tier in v1.
- **Differentiation**: how this differs from existing "diagram-as-code" and architecture tools.
- **Naming**: working name is `Archmantic`.
