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

### INS-024 · Subagents inherit the MCP tools but nothing tells them to use it — FIXED (plugin v0.4.0)
- **category:** agent-dx · **audience:** both · **status:** shipped (SubagentStart hook + skill/explorer)
- **insight:** In multi-agent runs the *subagents* are the heavy file-readers, so that's where the
  token savings should land. Confirmed live: the founder ran a **6-subagent** task in `guide-deck`;
  `usage.jsonl` showed the **main agent used Archmantic (12 reads) but the subagents recorded zero** —
  they read files raw. Mechanics: **`PreToolUse` hooks do NOT fire inside subagents**, and
  `Explore`/`Plan` skip CLAUDE.md/AGENTS.md. The advisory v0.3.0 levers (skill nudge + explorer)
  weren't enough because a generic fan-out doesn't delegate to the explorer or pass the instruction.
  Also a real bug: the plugin registers tools as **`mcp__plugin_archmantic_archmantic__*`** but the
  skill/hook/command/explorer/README said **`mcp__archmantic__*`** — a name that doesn't exist in a
  plugin-only install (the main agent resolved it; a small-model subagent wouldn't), and the README's
  permission allow-list didn't match the real tool names.
- **fix (v0.4.0):** (1) **`SubagentStart` hook** — fires for *every* subagent (incl. parallel
  fan-outs / other plugins' workflows / Explore-Plan), allowed in a plugin's top-level `hooks.json`
  with global scope, injecting `additionalContext` that nudges the subagent to query the model first
  (gated on a model existing; skips Archmantic's own agents). This is the only mechanism that reaches
  arbitrary subagents. (2) All guidance switched to **bare tool names** (`get_context`, …) so it works
  regardless of namespace; (3) README allow-list corrected to `mcp__plugin_archmantic_archmantic__*`.
  Kept from v0.3.0: skill delegation guidance + the `archmantic-explorer` subagent.
- **still open:** SubagentStart is a *nudge*, not enforcement — a subagent can still read files. Hard
  enforcement would need custom subagent definitions that drop Read/Grep (heavier, opt-in).
- **why:** Otherwise the optimization stops at the orchestrator while a fleet of subagents reads
  files raw — the worst case for tokens.

### INS-023 · One corrupted line blanked the entire usage log (under-reported savings) — FIXED (1.19.3)
- **category:** dx · **audience:** humans · **status:** shipped
- **insight:** `readUsageLog` did `.split("\n").map(JSON.parse)` in one try/catch, so a **single**
  malformed line (interleaved concurrent append from multiple MCP server processes, or a hard kill
  mid-write) made it return `[]` — `archmantic usage` and the cloud backlog flush then showed
  **zero** events. Dogfood: this repo's log had exactly one bad line. Also `get_architecture_map`
  (the flagship onboarding tool) was missing from `BROAD_TOOLS`, so its "tokens saved" used the
  small 12%-of-repo baseline → undercounted. And the plugin's `.mcp.json` passed no env, so usage
  only reached the cloud dashboard if a project had `.env.local` with a token.
- **fix:** tolerant line-by-line parsing (skip bad lines, keep the rest); add `get_architecture_map`
  to `BROAD_TOOLS`; `loadEnv` now also reads `~/.archmantic/.env` so one global `ARCHMANTIC_TOKEN`
  makes every project report. **Reality check:** the log also showed actual MCP *reads* have been
  low (~4 ever) — adoption (INS-022's plugin/skill/hook, just shipped) is the bigger lever; this
  fix ensures the savings actually *show* once reads climb.
- **why:** "It saves tokens but usage doesn't show it" erodes the whole proof-of-value loop.

### INS-022 · Archmantic gets ignored in multi-plugin setups — ship it as a Claude Code plugin — SHIPPED (v1)
- **category:** agent-dx · **audience:** both · **status:** shipped (plugin v0.1.0)
- **insight:** A founder reported that across several projects, once **superpowers** + other
  plugins were installed, the agent **stopped using Archmantic**. Root causes (grounded): (1)
  Archmantic was a *passive, manually-wired MCP server* with descriptive-only tool text and
  **no trigger** telling the agent *when* to use it — while superpowers ships skills with
  aggressive "use this before ANY response" priming that crowds it out; (2) with many plugins,
  Claude Code **defers** MCP tools (schemas not loaded; the agent must search to find them) — so
  Archmantic is effectively invisible unless something points at it; (3) the generated
  `AGENTS.md` quietly substitutes, so the live tools go unused; (4) per-tool permission prompts
  (INS-015) add avoidance; (5) no slash command / hook / CLAUDE.md nudge.
- **fix:** Ship Archmantic as a **Claude Code plugin** (`plugin/` + repo-as-marketplace):
  a **trigger skill** (`use-archmantic` — "before reading/grepping many files, query the model")
  is the behavioral hook that makes the agent reach for it; the **MCP server auto-registers**
  (no manual `claude mcp add`, pinned `@latest` which also dodges INS-017 staleness); a
  **`/architecture`** command; and a documented `mcp__archmantic__*` allow-list (plugins can't
  set permissions, so it's in the plugin README). Install: `/plugin marketplace add
  mgionas/Archmantic` → `/plugin install archmantic@archmantic`.
- **why:** Adoption — Archmantic only earns its "for agents" thesis if agents actually reach for
  it. A passive MCP server loses to trigger-rich skills; a plugin puts it on the same shelf and
  primes usage. Distribution win too (marketplace install path = same as superpowers).
- **follow-up shipped (plugin v0.2.0):** added a **PreToolUse hook** (Read/Grep/Glob) — once per
  session, in a repo with a model, it injects a non-blocking `additionalContext` nudge to query
  Archmantic before reading many files (a stronger behavioral push than the skill alone, to beat
  other plugins' priming). Silent when no model / after the first fire. Node-based (no `jq`).
- **still open:** plugins can't bundle permission rules (must be documented).

### INS-020 · Singleton-collapse "Misc" can swallow a legitimately-separate group
- **category:** dx · **audience:** humans · **status:** open (INS-014 follow-up)
- **insight:** `deriveGroups` collapses every <2-member domain into "Misc". Dogfooding on
  `social-seed`, that swept **7 real public/account pages** (login, register, my-pages,
  privacy, terms, deletion, connect-page) into Misc — which the Map then de-emphasizes and
  drops from edges (INS-014), losing real signal. Options: don't collapse when the leftover
  set is itself sizeable (≥N members → its own "Pages"/"Other" cluster), attach singletons to
  their nearest dependency cluster, or bucket by a coarser path/role before dumping to Misc.
  Also a tension surfaced: curation can rename Misc (I named it "Public & Account Pages"), but
  the Map still mutes `group:domain:misc` **by id** regardless of name — a curated name on a
  muted bucket. The mute should key off "is-this-the-catch-all" semantics, not a fixed id.
- **why:** The collapse is meant to kill confetti, but here it hid a coherent, real group and
  exposed a curate↔map conflict. The one rough edge left on the onboarding view.

### INS-021 · Path-alias imports (`@/*`) were modeled as external systems — FIXED
- **category:** product-gap · **audience:** both · **status:** shipped
- **fix:** `tier1` now loads `compilerOptions.paths` (+ `baseUrl`) from tsconfig/jsconfig
  (`loadAliases`) and resolves alias imports to internal files **before** the external
  fallback. Dogfood on `social-seed` (`"@/*": ["./*"]`): the fake externals `@/components`,
  `@/db`, `@/lib` are gone, and **internal dependency edges jumped 8 → 176** — the alias
  imports were the bulk of the real graph, previously dropped. Also fixes the old "Used by (0)"
  under-representation for any aliased codebase (most Next.js apps).
- **why:** Any import starting with `@` was assumed to be an npm scope, so the single most
  common Next.js convention (`@/`) produced garbage external systems *and* a near-empty
  dependency graph. The Map/Context looked sparse and noisy at the same time.

### INS-019 · External classifier misses AI/SaaS SDKs and raw-HTTP services
- **category:** product-gap · **audience:** both · **status:** shipped (SDKs) / open (raw HTTP)
- **fix:** Added the major AI provider SDKs to `EXTERNAL_SYSTEMS` (`stack.ts`) as `saas` —
  `@google/genai`, `@google/generative-ai`, `@langchain/{google-genai,openai,anthropic}`,
  `@mistralai/mistralai`, `cohere-ai`, `replicate`, `@huggingface/inference`. Dogfood: Gemini
  (`@google/genai` + `@langchain/google-genai`) now appears as a real system on `social-seed`.
- **insight:** `@google/genai` (Gemini) was classified `library`, so the AI provider never
  appeared as a real system on the Context graph / Map — only Neon did.
- **still open:** the Facebook Graph API and Telegram Bot API are reached over **raw `fetch`**
  (no npm package), so a package-name classifier can't see them — capturing HTTP-host externals
  (from fetch base URLs / env-configured endpoints) is a larger, separate piece.
- **why:** "What external systems does this touch?" is a core Context/Map answer; missing the
  AI provider and the social APIs badly understates the real integration blast radius.

### INS-018 · Agent-driven curation is the headline — the keyless path shouldn't read as "skipped"
- **category:** agent-dx · **audience:** both · **status:** open
- **insight:** Running `publish --ai` on `social-seed` from inside a CLI agent session printed
  *"AI curation skipped: no ANTHROPIC_API_KEY"* and nudged toward BYOK. That framing is
  backwards: the locked design is **agent-driven** — the connected agent *is* the AI (read
  `get_architecture_map`, write `curate`) on the session the user already pays for; BYOK is the
  CI/headless **fallback**, not the headline. Proof it works keyless: the agent hand-authored
  `social-seed`'s `curation.json` (10 domains named + positioning narrative), `analyze` merged
  it, `push` shipped it — no key, no metered LLM.
- **fix sketch:** (1) `cmdCurate` / `publish --ai` messaging when no key → print the
  agent-driven instructions (or the `get_architecture_map` payload) instead of a skip warning;
  (2) a `curate --emit` that dumps the map payload for an agent to act on; (3) lead the
  README/quickstart curation section with the agent path, BYOK second.
- **why:** The current message makes the cheapest, most on-strategy path look *unavailable* and
  pushes users toward a paid key they don't need — undercutting the whole "your agent, your
  tokens" positioning.

### INS-017 · A stale MCP server can't warn about its own staleness
- **category:** agent-dx · **audience:** both · **status:** open
- **insight:** Dogfooding on the `social-seed` test project, the wired MCP server was a
  pre-0.2.0 build. Its `model.json` stayed `schemaVersion: 0.1.0` (no `groups`/`externalKind`/
  `narrative`) even after `refresh` — so the agent got a silently-degraded, flat,
  pre-experience-layer analysis with **no signal anything was out of date**. The 1.15.0
  schema-drift check only fires from a *current* CLI; an old server doesn't know newer
  schemas exist, so it can't flag itself. The staleness signal has to come from outside the
  old server: `get_project` (and `analyze`/`refresh` output) should report the running
  archmantic version + model `schemaVersion`, and the npx/host path should warn when the
  linked server lags `latest` on npm (or when `model.schemaVersion < SCHEMA_VERSION`).
- **why:** Users wire the server once and forget it. A version that silently regresses the
  whole product surface — no domains, no Architecture Map, unclassified externals — reads as
  "the tool is shallow," not "the server is old." This is the single failure mode most likely
  to make a real user mis-judge Archmantic on first contact.

### INS-016 · AGENTS.md is non-deterministic, stale-classified, and not re-committed — FIXED
- **category:** dx · **audience:** both · **status:** shipped
- **fix:** `knowledge.ts` now sorts all lists (capabilities/externals/roles → deterministic,
  no churn), filters externals via `isSystemExternalKind` (libraries/runtime gone — verified
  on this repo: only @anthropic-ai/sdk + @neondatabase/serverless), and adds the new layers
  (the curated **narrative** + a **Domains** line). The `update --hook` snippet now `git add`s
  `AGENTS.md` too. Note (new dogfood quirk): the hook runs `npx archmantic` = the *published*
  CLI, so while developing Archmantic itself it regenerates with the old version — committed
  here with `--no-verify`; a future hook could prefer a local build.
- **insight:** Three papercuts in the generated knowledge file (`knowledgeMarkdown`), all
  surfaced while wiring the CI reconciler: (1) capability/external **ordering is
  non-deterministic** — every `analyze`/`update` reshuffles AGENTS.md, so it churns; it
  should sort like `model.json` does. (2) It still lists **libraries/runtime as "External
  systems"** (`node:fs`, `typescript`, `zod`) — it never adopted the 1.18.0 `externalKind`
  classification; should filter to real systems. (3) It's **missing the new layers** — no
  domains/Architecture-Map summary, no curated narrative. Also the `update --hook` snippet
  `git add`s `model.json` but **not `AGENTS.md`**, so the regenerated AGENTS.md is left
  perpetually dirty in the worktree after every commit.
- **why:** AGENTS.md is the non-MCP agent's whole context — non-determinism makes diffs
  noisy and erodes trust, and the stale "externals" contradict the de-noised graphs. Quick,
  high-leverage fix in `src/project/knowledge.ts` (+ the hook snippet).

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

### INS-014 · Curation is agent-driven — and the "Misc" bucket reads as a real domain — FIXED
- **category:** agent-dx · **audience:** both · **status:** shipped
- **fix:** `architectureMap` now flags the `group:domain:misc` catch-all as `muted` and excludes
  it from the structural dependency edges (it was both originating and receiving cross-domain
  edges, reading as a hub everything depends on). The Map renders it as a de-emphasized,
  dashed "leftovers" pile — still openable to find its components, but clearly not a real domain.
- **insight:** Phase D landed the agent-driven curation loop (`get_architecture_map` →
  `curate`, the user's agent on its own tokens, merged via committed `.archmantic/curation.json`,
  no managed LLM). Dogfood: the agent curated this repo's 8 domains + a positioning narrative.
  The singleton-collapse "Misc" bucket appeared in the map (even as a dependency target) — it
  should be visually de-emphasized / excluded from edges, or domains should collapse more
  gracefully (e.g. attach singletons to their nearest dependency cluster — a future option).
- **why:** Proves the "human + agent share one model" thesis end-to-end. The Misc noise was the
  one rough edge a real onboarding view would trip on.

### INS-013 · Map drill is a name-match heuristic; Components needs a real domain filter — FIXED
- **category:** dx · **audience:** humans · **status:** shipped
- **fix:** The Map drill now passes the domain **`groupId`** (not its label) to Components,
  which filters exactly on `c.groupId`. Components carry `groupId`/`domain` end-to-end
  (page → `Comp`), there's a removable domain-filter chip, and a new **group-by-domain**
  option in the Components toolbar (shown when domains exist).
- **insight:** Clicking a domain on the Map jumped to Components with the domain *name* as a
  text query. It worked because names ≈ folders, but a first-class "filter by `groupId`"
  (now that components carry it) is exact and also lets Components group by domain.
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
