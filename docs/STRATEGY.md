# Archmantic — Strategy & Business Model

> Decided 2026-06-14. Model: **open-SaaS**. Core open (Apache-2.0), cloud source-available (AGPL-3.0). Monetize **managed hosting + metered AI + enterprise**. Framing: **fundable startup.**

## Positioning

A living, *trustworthy* architecture model your team **and your AI agents** share — grounded in code, editable, and the source an agent builds from. Not another "AI diagram" (ungrounded) and not a code-graph tool (symbols, no humans, no business view). The wedge competitors can't copy: **capability map + BPMN + provenance/trust + edit-then-build.**

## The model: open-SaaS

Open the wedge; charge for the hosted network and managed compute. The dividing line is **single-user/local value (free, open)** vs **multi-user/hosted/managed value (paid)**.

### Open-source (public, Apache-2.0) — `/src`, the CLI & engine
The local engine is the top of funnel and the trust story (code never leaves the machine):
- CLI: `analyze · update · view · drift · diff · log · spec · bench`
- IR/model, analyzers (Tier 0/1 + structural derivation), projections (capability map, React Flow views incl. the business process, trust)
- MCP server (read tools) — token savings is table stakes; free
- Tier-2 LLM + `handoff` + autonomous build in **BYOK** mode (your keys)

Apache-2.0 → maximal adoption + enterprise-friendly + invites community **language analyzers** (Go/Python/Java).

### Source-available (public, AGPL-3.0) — `/web`, the cloud platform
- Multi-tenant web app (orgs, shared model, **editable feature/curation layer**, **commit-history timeline**, team review)
- Authenticated push/pull API, token management
AGPL keeps it open/auditable (great for a dev/architect audience) while preventing a competitor from hosting it as-is for profit.

### Closed / managed (the revenue)
Sold as a service, not source-restricted features:
- **Managed hosting** (don't run Neon/Vercel yourself)
- **Managed AI**: no-BYOK Tier-2 / `handoff` / autonomous-build runners (real compute → metered)
- **Enterprise**: SSO/SAML, RBAC, audit logs, drift-gate CI service, cross-repo portfolio, on-prem, SLA

## Pricing & packaging

| Tier | Who | What | Price |
|---|---|---|---|
| **Free** | solo, OSS, small teams | Full CLI + MCP + self-host (BYO Neon `push/pull`) + BYOK AI; **managed cloud up to 3 seats** | $0 |
| **Team** | growing teams | Managed cloud, org sharing, web canvas + commit timeline, CI architecture-diff bot | **per seat / mo** (beyond 3) |
| **Managed AI** | any paid tier | No-BYOK Tier-2 / handoff / autonomous build | **metered** (compute passthrough + margin) |
| **Enterprise** | orgs | SSO/RBAC/audit, on-prem, portfolio, SLA, support | custom |

Primary axis = **per-seat** (collaboration is the value). **Metered** only for AI runners (the one real marginal cost). Free includes **up to 3 seats** so a small team can adopt before paying — land-and-expand.

## Moat / defensibility
1. **Shared living model as team knowledge** — committed history + human edits create switching cost.
2. **Edit-then-build loop** — edit the diagram → it's the source → an agent builds it. No competitor does this.
3. **Provenance/trust** quality — verifiable, not plausible.
4. **Managed autonomous-build compute** — the metered, sticky service.
5. **Data flywheel** — more repos analyzed → better heuristics/templates; team history → retention.

Token savings is *not* a moat (table stakes); it's a reinforcement, never the headline. See `docs/COMPETITORS.md`.

## Organization / legal
- **License layout:** `LICENSE` (Apache-2.0) governs the repo/core; `web/LICENSE` (AGPL-3.0) governs `web/`. `package.json` license fields match.
- **Trademark** "Archmantic" (brand protected even with open code — the Plausible move).
- **Contributions:** DCO/CLA so the core can be relicensed if needed.
- **Repo:** single public repo, per-directory licensing (no public/private split to maintain).

## Path to revenue (fundable framing)
1. **Adopt** — free CLI/MCP wedge; OSS repos commit `.archmantic/model.json` (built-in distribution).
2. **Expand** — teams hit the 3-seat free ceiling → Team tier.
3. **Monetize compute** — autonomous build / managed AI metered (high willingness to pay; clear marginal cost).
4. **Enterprise** — governance + on-prem + portfolio.
Investor story: a developer-trust OSS wedge → a sticky team SaaS → metered AI build compute, in the fast-growing "agents need grounded context" market.
