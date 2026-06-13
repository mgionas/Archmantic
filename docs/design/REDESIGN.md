# Internal Pages Redesign — Plan

> Synthesis of the [ux-researcher] audit + [ui-designer] proposal for Archmantic's
> authenticated web surface (project view, systems, usage, settings). Goal: a
> professional, full-bleed, Linear/Vercel-grade tool with **interactive** diagrams.
> Landing page (`/`) is out of scope — it keeps its centered marketing layout.

## Root causes (confirmed in code)

1. **Width** — every page is hard-capped at `max-w-6xl` (1152px) in `layout.tsx`; the
   diagrams and tables that need room are boxed into a marketing-width column.
2. **Static diagrams** — `Mermaid` injects an SVG into an `overflow:auto` div: no
   zoom/pan/fit/fullscreen, theme hardcoded to dark, no loading/error/a11y. BPMN is
   interactive, so diagrams behave inconsistently within one view.
3. **Chunky tabs** — the project view stacks 3–4 hero cards, then an outer pill
   TabsList, then a *second* nested TabsList inside Diagrams. Two stacked pill rows =
   the "clunky" feel; facet state is local (not linkable/refreshable).

## Locked direction

- **Split the shell:** marketing (`/`) stays centered; app routes go **full-bleed**.
- **Navigation = two thin levels, no horizontal pill rows:**
  - a persistent **global icon-rail** (56px): Projects · Systems · Usage · Docs ·
    Settings + theme/org/user. Reachable from inside a project (today you must go back).
  - a **project facet column** (~190px, collapsible to icons): Overview · Diagrams ·
    Capabilities · Components · Data · API · Changes. Driven by a URL param (linkable).
  - diagram sub-views (Context/Components/Sequence/Process) become a **segmented
    control in the canvas toolbar** — one level of nesting, not a second nav row.
- **Interactive diagram canvas** via **`react-zoom-pan-pinch`** (~12 kB): wraps the
  existing Mermaid/ERD SVG *and* the bpmn-js container, so one `<DiagramCanvas>` +
  toolbar (fit · zoom± · reset · fullscreen · copy source) serves every diagram.
  BPMN keeps its native zoom, driven by the same toolbar. Theme-aware rendering.
- **Overview facet** absorbs the trust scorecard + externals + tech stack, so other
  facets (Diagrams especially) open immediately at full height.
- **Tokens:** tighter radius (0.5rem), formal spacing/type scale, and **semantic
  color roles** (`success`/`warning`/`danger`/`canvas`) to replace scattered
  green/amber/red literals and hardcoded hex (`#7aa2f7`, `#fff`), fixing light-mode
  diagrams. WCAG-AA throughout; non-color encoding for trust bands + HTTP methods.

## Project view shell (target)

```
┌──┬──────────┬──────────────────────────────────────────────────────────────┐
│▪ │ payments │  Projects ▸ payments-api          [snapshot ▾ a1b2c3] +2 −1   │ context header
│⊞ │ Diagrams │ ┌──────────────────────────────────────────────────────────┐ │
│⌗ │ Capab.   │ │ [Context|Components|Sequence|Process]   ⤢ ⊕ ⊖ ⟲ ⛶ ⧉  100%│ │ canvas toolbar
│  │ Compo. 12│ │ · · · ┌─────────┐         ┌─────────┐ · · · · · · · · · · ·│ │
│  │ Data    8│ │ · · · │ Gateway │────────▶│ Ledger  │ · · · · · · · · · · ·│ │ INTERACTIVE
│◔ │ API    34│ │ · · · └─────────┘         └─────────┘ · · · · · · · ·minimap│ │ canvas (full height)
│⚙ │ Changes 3│ └──────────────────────────────────────────────────────────┘ │
└──┴──────────┴──────────────────────────────────────────────────────────────┘
 56px   190px                          full-bleed
```

## Phases (each independently shippable; app never breaks between them)

- **P0 · Tokens** — radius/spacing/type/semantic-color tokens in `globals.css`;
  migrate `BAND_CLASS`/`METHOD_CLASS`/`LINK_STYLE` to `text-success/warning/danger`.
  Near-zero visual change. New deps: none.
- **P1 · App shell** — add `sidebar`/`tooltip`/`sheet` (Base UI); rewrite `layout.tsx`
  (drop `max-w-6xl`, add rail + responsive collapse); a `(project)` layout segment
  renders the facet column + context header from a URL param. Systems/Usage/Settings
  reflow full-bleed. Facet content still rendered by today's components.
- **P2 · Diagram canvas** — add `react-zoom-pan-pinch`; build `<DiagramCanvas>` +
  segmented control; theme-aware Mermaid; `bg-canvas` BPMN with a real toolbar.
  The headline upgrade, isolated to the Diagrams facet.
- **P3 · Facet polish** — retire the outer tabs into URL-driven facet views; ERD =
  canvas + entity inspector split; API = sticky search/filter table + row→detail
  drawer; loading/error/empty states for diagrams.
- **P4 · Delight (optional)** — ⌘K command palette, clickable diagram nodes →
  cross-facet detail panel, ERD search-to-focus, PNG/SVG export, minimap thresholds.

## New components (all on Base UI; no `asChild`)

`sidebar.tsx`, `tooltip.tsx`, `sheet.tsx`, `segmented.tsx` (thin wrapper over the
existing `tabs` line variant), `diagram-canvas.tsx`. Optional later: `command.tsx`,
`resizable.tsx`. One runtime dependency total: `react-zoom-pan-pinch`.
