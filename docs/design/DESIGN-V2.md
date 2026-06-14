# Web Design v2 — plan

> **Status: shipped (Phases 1–4).** Deferred by choice: full type/spacing token
> migration, `<FacetToolbar>`, row virtualization (`@tanstack/react-virtual`),
> per-node graph keyboard activation (covered by list views), self-hosted landing
> logos, and the usage-chart data-table/CSV a11y. No new runtime deps added.

Synthesis of a UX/IA audit (ux-researcher) + a visual/design-system audit (ui-designer)
of the `web/` app. The system is solid (token plumbing, shared `useFlowProps`/
`GraphDrawer`, dark-first oklch); gaps are scale (70+ feature deck picker), an
incomplete design-token layer, inconsistent diagram chrome, and unused installed
primitives (`table`, `dialog`, `skeleton`, `sonner`, `dropdown-menu`).

## Phase 1 — Foundations (low-risk)
- Type + spacing scale tokens in `globals.css`; stop picking sizes ad hoc. Min 12px for meaningful text.
- Themed, token-backed role colors (`--role-*` light/dark) so `roleColor()` is theme-aware; one shared `<RoleLegend>` on every graph + the Components facet.
- Shared primitives: `<SegmentedControl>`, `<FacetToolbar>`, `<EmptyState>` with `focus-visible` rings.
- Contrast bump (dark `--muted-foreground`, border alpha) + `prefers-reduced-motion` guard on graph `fitView`.

## Phase 2 — Highest-leverage UX
- **Deck picker → searchable selector + URL state** (`?seq=`/`?proc=`): the 70+ feature button wall → typeahead. (#1 finding both audits.)
- `<DiagramCanvas>` shared frame: background/minimap/controls + fullscreen + legend slot + standard `EDGE_LABEL` plate (Context/ERD labels collide today).
- Graph accessibility: focusable nodes (Enter/Esc), focus trap in drawer, per-graph "List view" fallback.
- Feature "pending pull" badge (warning) + `sonner` toast with copy-`feature pull` (the edit-then-build status is invisible today).

## Phase 3 — Density, IA, differentiator
- API facet → `<Table>`; Components grid/list toggle + virtualize 400+ lists; unify headers via `<FacetToolbar>`.
- IA: move ERD into the Diagrams group; breadcrumb in the empty top-bar slot; labeled sidebar over icon-only rail.
- Make provenance drillable: list cards open the graph detail drawer / link to `file:line` (the "verifiable" claim, underexposed).
- Feature edit → `dialog` (stops card-grid reflow); clearer read-card hierarchy.

## Phase 4 — Polish & perf
- Shared EmptyState/Skeleton/error + `loading.tsx`; Overview trust band (hi/med/lo bar) + reorder; landing token cleanup + self-host stack logos; usage-chart a11y; cache model projections per `owner+project+sha`.

## Notes
- Keep `@xyflow/react` + dagre. Stay dependency-light: build the searchable picker on existing primitives rather than adding cmdk unless a global ⌘K is wanted later.
- Dark-first (next-themes, system disabled), so light-mode role-color fixes are lower urgency but still correct.
