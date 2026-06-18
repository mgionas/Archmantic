# Archmantic — Insights & Observations (backlog seed)

> A living capture file. We dogfood Archmantic on Archmantic, so every step that's
> awkward for *us* (human or agent) is a product signal. Each entry is grist for the
> backlog — and a candidate to expose over MCP later (`list_insights` / a write tool
> so agents can both read and *contribute* observations while they work).
>
> Format per entry — keep it parseable:
> `### <id> · <title>` then bullets: **category** (design | architecture | product-gap |
> agent-dx | dx | ux | idea), **audience** (humans | agents | both), **insight**,
> **why**, **status** (open | planned | shipped). Newest first.

---

### INS-015 · Document the MCP allow-list — users hit per-tool permission friction
- **category:** dx · **audience:** humans · **status:** open
- **insight:** When you wire archmantic as an MCP server in a host (Claude Code, etc.), the
  host prompts "Allow tool use?" on *every* tool call. The fix is one permission rule —
  `mcp__archmantic__*` in the host's `.claude/settings.json` `permissions.allow` (the bare
  `mcp__archmantic` does **not** work; the `__*` is required). The README/quickstart's MCP
  section should call this out, with both the allow-all rule and a reads-only variant (since
  `*` also auto-approves the write tools `refresh`/`sync`/`sync_features`/`curate`).
- **why:** Every real user hits this on first connect; undocumented, it reads as the tool
  being annoying. A two-line quickstart note removes the friction and the "is this safe to
  allow-all?" doubt. Surfaced from a real user question while dogfooding.

### INS-014 · Curation is agent-driven — and the "Misc" bucket reads as a real domain
- **category:** agent-dx · **audience:** both · **status:** shipped (loop) / open (polish)
- **insight:** Phase D landed the agent-driven curation loop (`get_architecture_map` →
  `curate`, the user's agent on its own tokens, merged via committed `.archmantic/curation.json`,
  no managed LLM). Dogfood: the agent curated this repo's 8 domains + a positioning narrative.
  Polish needed: the singleton-collapse "Misc" bucket appears in the map (even as a dependency
  target) — it should be visually de-emphasized / excluded from edges, or domains should
  collapse more gracefully (e.g. attach singletons to their nearest dependency cluster).
- **why:** Proves the "human + agent share one model" thesis end-to-end. The Misc noise is the
  one rough edge a real onboarding view would trip on.

### INS-013 · Map drill is a name-match heuristic; Components needs a real domain filter
- **category:** dx · **audience:** humans · **status:** open
- **insight:** Clicking a domain on the Map jumps to Components with the domain *name* as a
  text query. It works because names ≈ folders, but a first-class "filter by `groupId`"
  (now that components carry it) would be exact and also let Components group by domain.
- **why:** Closes the L2→L3 drill cleanly; surfaced while wiring the Architecture Map.

### INS-012 · Test files are modeled as architecture components — FIXED
- **category:** product-gap · **audience:** both · **status:** shipped
- **insight:** Dogfooding groups revealed a "Test" domain with 24 members — test files were
  walked as `Component`s, inflating the model, the Map, and trust stats. Fixed: `walkSourceFiles`
  now excludes `isTestFile` paths (test/spec/stories/mocks/e2e), so they never enter the model.
- **why:** Found only because we cluster now — the flat graph hid it. Dogfood: this repo
  62 components (was 86); the "Test" domain is gone. The clustering view paid for itself
  on its first run by exposing a latent modeling bug.

### INS-011 · Capture insights as a first-class, MCP-exposable stream
- **category:** idea · **audience:** both · **status:** open
- **insight:** This file should become structured data an agent can read *and append to*
  over MCP (`list_insights`, `add_insight`), then promote to backlog items.
- **why:** Agents working in the repo notice friction/gaps the moment they hit them; if
  they can record it where the team triages, the dogfood loop closes itself. Humans get a
  curated backlog; agents get a memory of "what's known-broken / known-planned."

### INS-010 · Diagrams projected the raw import graph (the root cause)
- **category:** architecture · **audience:** both · **status:** shipping (Phase A)
- **insight:** Context/Components/Sequence were 1:1 projections of `tier1` import edges —
  every bare import (incl. `lucide-react`, `node:fs`) became an "external system," and
  "sequences" were import edges relabeled "calls."
- **why:** It made the views mechanical and untrustworthy on first glance — fatal for an
  onboarding tool. The ERD is good precisely because it projects *meaning*, not imports.

### INS-009 · One model, two audiences, an AI layer between (the concept)
- **category:** design · **audience:** both · **status:** planned
- **insight:** Agents want *semantic structure* (the grounded graph, provenance, slices);
  humans want *context + a story*. So: **collect** deterministically (cheap, for agents),
  **curate** with AI (clean/name/narrate, for humans), **present** per audience.
- **why:** Stops us hand-tuning a thousand grouping heuristics; the deterministic layer
  grounds, AI curates. See `docs/design/EXPERIENCE-LAYER.md`.

### INS-008 · Libraries ≠ external systems (shipped in Phase A)
- **category:** architecture · **audience:** both · **status:** shipped
- **insight:** `stack.ts` already knew `lucide-react` is a UI lib and `pg`/Stripe/Neon are
  real systems — the diagrams just ignored it. Now `classifyExternal` tags each external
  `datastore|saas|infra|service|library|runtime` (`System.externalKind`); graphs draw only
  real systems, libraries move to the Technologies page.
- **why:** Dogfood proof — this repo's context graph went from **13 external nodes (11 noise)
  → 2 real systems** (Neon + Anthropic). One classifier fixed ~6 of the founder's complaints.

### INS-007 · Agent-facing MCP surface needs the *curated* model, not just the raw graph
- **category:** agent-dx · **audience:** agents · **status:** open
- **insight:** Add `get_architecture_map` (curated L1/L2 containers + edges) and make
  `get_context` report classified externals + domains, not a flat import dump. Track *which*
  skills/agents `suggest_skills`/`get_skill` serve (subject on the usage event).
- **why:** An agent onboarding to a repo should get the same "what is this, how is it shaped"
  answer a human gets — in tokens, grounded. Today it'd get the noisy flat view.

### INS-006 · Sequences/flows must be behavior, scoped to features — not imports
- **category:** product-gap · **audience:** both · **status:** planned
- **insight:** A sequence should model entry → layer hops → data/external for a *chosen
  feature/endpoint*, grounded to call sites — never "Page calls lucide-react." Drop the
  auto one-liner BPMN; "Process" becomes feature journeys.
- **why:** "Sequence diagram only needed when working on logical features" — founder. The
  renderer is fine; what feeds it is wrong (`flows.ts` walks import edges).

### INS-005 · Semantic grouping (domains/layers) is the missing middle level
- **category:** architecture · **audience:** both · **status:** planned
- **insight:** There's nothing between "whole repo" and "every file." Add an IR `Group`
  (layer/domain/area/package) derived from folder+role+package, curated/named by AI.
- **why:** Enables the C4 L1→L4 zoom (System → Map → Components → Code) — the onboarding
  spine. Graphs cluster instead of being flat hairballs.

### INS-004 · Capabilities / Knowledge / Diagrams facets are noise as-is
- **category:** ux · **audience:** humans · **status:** planned
- **insight:** Capabilities = `humanize(exportName)` dump → fold into component detail +
  AI domain descriptions. Knowledge = raw `<pre>` md → render it, fold into Overview.
  "Diagrams" as a destination → diagrams belong with the question they answer. Facets 13→~8.
- **why:** Facet sprawl + dry views. ERD is the quality bar to match.

### INS-003 · Git as the sync transport; repo-canonical, web edits as proposals
- **category:** architecture · **audience:** both · **status:** decided
- **insight:** The hosted app can't see the disk. Make **git the message bus** (web edits →
  branch/PR via a git-host App; CI runs analyze→push as the reconciler). Repo stays
  canonical; edits are proposals; conflicts surface in the PR.
- **why:** One channel both sides reach; free history/diff/review; cloud DB demotes to a cache.

### INS-002 · Rule engine must stay generative, not a straitjacket
- **category:** design · **audience:** humans · **status:** planned
- **insight:** Advisory-by-default, baseline-ratchet (flag only *new* violations),
  rules-as-data (team-authored, like Skills), violations-as-ADRs, surface emergent structure.
- **why:** A rigid "clean architecture" linter fights the evolution it's meant to support.

### INS-001 · Breaking-change detection, led by cross-repo impact
- **category:** product-gap · **audience:** both · **status:** planned
- **insight:** PR review that flags removed/changed endpoints/entities/capabilities — and
  especially "this breaks sibling service X that consumes you" via the multi-repo link graph.
- **why:** Nobody does architecture-level contract-breakage. The teeth on the PR-diff USP.
