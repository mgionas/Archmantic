# Skills layer — model-resolved playbooks on the shelf

Archmantic maintains a grounded model of a repo (stack, data model, API surface,
externals, features, processes). The **Skills layer** turns that model into action:
an on-shelf catalog of reusable **playbooks** that Archmantic resolves *against the
model* — given what this repo actually is, which skills are relevant, and **why**.

Skills are **data, never executed here**. `suggest_skills` recommends; the agent (or
human) decides whether to apply one. The model-first / provenance framing holds:
every recommendation cites a concrete, grounded reason. Shipped 1.17.0 (`src/skills/`).

## Concept & rationale — resolution, not a marketplace

A flat skill/agent marketplace makes the human do the matching: browse, guess what
fits, hope. The differentiator here is that the **grounded model does the matching**.
A skill declares *conditions* (triggers) phrased in the model's own vocabulary; the
resolver evaluates them against the real model and ranks the shelf by relevance,
attaching the reason each one fired ("Laravel detected", "external dependency:
Stripe", "12 API endpoints"). The result is "the right skill, right now, and here's
why" instead of a directory to scroll.

This is only possible *because* Archmantic already has the IR. Skills are a thin,
high-leverage projection of work the analysis pipeline already did — the same asset
that powers diagrams and MCP, pointed at "what should an agent do next?".

## The shape of a skill

```
Skill
  id, name, description
  body            // the playbook an agent applies (markdown)
  agent?          // advisory subagent type to run it (NOT auto-invoked)
  when: Trigger[] // conditions matched against the model
  tags: []
  source          // builtin | local
  origin          // "builtin", a local file path, or the fetched URL (provenance)
```

Authored/fetched skills are repo files — `.archmantic/skills/<slug>.md`, frontmatter
+ a markdown body — git-versioned, agent-editable, diffable, exactly like features.

```md
---
name: Payment integration review
description: Audit payment flows for idempotency, webhook verification, secrets.
agent: core-engineer
tags: [payments, security, review]
when: [external:stripe, external:paypal]
---
Trace the payment flow through the relevant components.
- Charge/capture calls must be idempotent (idempotency keys)...
```

## Trigger vocabulary & scoring

Triggers are kept deliberately small and grounded so every match is explainable
(`src/skills/types.ts`, `resolve.ts`):

| Trigger | Fires when… | Reason it emits |
|---|---|---|
| `tech:<name>` | a detected technology matches | "Laravel detected" |
| `category:<cat>` | a tech category is present (orm/auth/ai/testing/…) | "auth present: NextAuth" |
| `external:<name>` | an external system/dependency is present | "external dependency: Stripe" |
| `role:<role>` | components with that role exist (page/route/store/…) | "8 page components" |
| `entity` | the data model is non-empty | "12 data entities" |
| `endpoint` | the API surface is non-empty | "34 API endpoints" |
| `feature` | features are defined | "6 features" |
| `process` | a business process is defined | "a business process is defined" |
| `monorepo` | workspaces are declared | "monorepo (5 packages)" |
| `always` | any project (baseline skills) | "applies to any project" |

**Scoring** sums the matched triggers' weights, cheapest-signal-loses so that
specific signals beat generic presence:

```
tech, external      1.0      // a named framework / dependency — the strongest signal
category            0.7
role                0.6
entity/endpoint/feature/process/monorepo   0.5
always              0.1      // baseline only
```

The resolver scores every skill, drops the misses (`score > 0`), and ranks by score
then name. A skill's `reasons[]` are the matched triggers' reason strings — surfaced
verbatim in `suggest_skills`. (The lone-`always` baseline reason is suppressed unless
it's the skill's only trigger, so generic skills don't crowd the "why".)

## Three supply layers

| Layer | Where | How it arrives | Trust |
|---|---|---|---|
| **builtin** | `src/skills/catalog.ts` (8 skills) | bundled as data — no file IO, no network | ships with the CLI |
| **local** | `.archmantic/skills/*.md` | authored by the team, or fetched (below) | in-repo, reviewable in PRs |
| **remote** | any URL | `archmantic skill add <url>` fetches the markdown into the local cache | opt-in, on demand |

`allSkills(root)` is the union, keyed by id — **local wins over builtin**, so a team
can override a shipped skill by dropping a file with the same slug. Remote add writes
the fetched markdown to `.archmantic/skills/<slug>.md` with an `archmantic:source`
provenance comment recording the origin URL; from then on it's just a local file.

The builtin shelf today: API contract review, data-model migration, Laravel test
scaffold, payment integration review, monorepo dependency map, feature spec writer,
auth hardening, and a baseline security review (`always`).

## Safety boundary — data only, no execution

This is a hard line. **Archmantic never runs a skill.** The Skills layer:
- *reads* the model and *recommends* (scores, ranks, explains);
- *fetches* remote skill markdown into a local file (data, not code);
- hands the agent or human the playbook body to apply — they decide.

The optional `agent:` field is **advisory** — it names a subagent that *would* suit
the skill; nothing auto-invokes it. Remote add is a plain `fetch` of markdown, never
an install or an exec. This keeps the layer safe to expose over MCP to any agent: the
worst case is an irrelevant suggestion, never an unexpected action.

## Surface — MCP, CLI, web

| Surface | Tools / commands |
|---|---|
| **MCP** | `suggest_skills` (model-ranked, with reasons), `list_skills` (the whole shelf + triggers), `get_skill(name)` (one playbook body) |
| **CLI** | `archmantic skill suggest` (default), `skill list`, `skill show <name>`, `skill add <url>` |
| **Web** | a Skills facet on the project view |

The rendering is compact and grounded by design (`renderSuggestions`/`renderSkillList`/
`renderSkill` in `src/skills/index.ts`) — `suggest_skills` leads with the match reason
and a pointer to `get_skill`/`skill show` for the full body, so an agent spends tokens
on the relevant playbook, not the catalog.

## Future

- **Signed remote registry** — a curated, versioned skill registry with signatures
  so `skill add` can verify provenance/integrity instead of fetching arbitrary URLs.
- **Skill execution / agent invocation** — opt-in, gated, audited: let a human or
  agent *apply* a skill (e.g. dispatch the advisory subagent) rather than only read
  it — without breaking the data-only default. The boundary moves only behind an
  explicit, logged opt-in.
- **Web skill-management UI** — author/edit local skills, browse and pin from the
  registry, and see the resolved/ranked shelf for a project in the canvas (today the
  web Skills facet is read-only; files are the source of truth).
- **Richer triggers** — drift/health signals (e.g. "schema drift present", "untested
  endpoints") so skills can target the model's *problems*, not just its shape.
