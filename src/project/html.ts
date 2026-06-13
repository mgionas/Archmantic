/**
 * Static HTML viewer — a single self-contained file that renders every
 * projection (context + component + sequence via Mermaid, the process via
 * bpmn-js, the capability map, and the trust layer). Dependency-light: pulls
 * Mermaid + bpmn-js from a CDN at view time, so the CLI ships no renderer.
 *
 * Per docs/ARCHITECTURE.md the CLI degrades to "open in browser"; this is that
 * artifact, written to .archmantic/view.html.
 */
import { type ArchitectureModel } from "../ir/types.js";
import { contextDiagram, componentDiagram, sequenceDiagram } from "./mermaid.js";
import { erDiagram } from "./erd.js";
import { bpmnXml } from "./bpmn.js";
import { groupCapabilities } from "./capability.js";
import { badge, band, isLowConfidence, summarize, type Grounded } from "./trust.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function allGrounded(model: ArchitectureModel): Grounded[] {
  return [
    ...model.systems,
    ...model.components,
    ...model.relations,
    ...model.capabilities,
    ...model.flows,
    ...model.processes,
    ...(model.dataEntities ?? []),
    ...(model.endpoints ?? []),
  ];
}

function apiSection(model: ArchitectureModel): string {
  const eps = model.endpoints ?? [];
  if (!eps.length) return "";
  const rows = eps
    .map(
      (e) =>
        `<tr><td class="method m-${esc(e.method.toLowerCase())}">${esc(e.method)}</td>` +
        `<td class="path">${esc(e.path)}</td><td class="proto">${esc(e.protocol)}</td></tr>`,
    )
    .join("\n");
  return `
  <h2>API surface — ${eps.length} endpoints</h2>
  <div class="card"><table class="api">
    <thead><tr><th>Method</th><th>Path / operation</th><th>Protocol</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function trustBanner(model: ArchitectureModel): string {
  const s = summarize(allGrounded(model));
  const pct = Math.round(s.meanConfidence * 100);
  return `
  <section class="trust">
    <div class="stat"><span class="num">${s.total}</span> grounded elements</div>
    <div class="stat"><span class="num">${s.totalRefs}</span> code references</div>
    <div class="stat"><span class="num">${pct}%</span> mean confidence</div>
    <div class="bands">
      <span class="b high">${s.high} high</span>
      <span class="b medium">${s.medium} medium</span>
      <span class="b low">${s.low} low ⚠</span>
    </div>
  </section>`;
}

function capabilitySection(model: ArchitectureModel): string {
  const groups = groupCapabilities(model);
  if (!groups.length) return "<p class='empty'>No capabilities derived yet.</p>";
  const blocks = groups.map((g) => {
    const items = g.capabilities
      .map(
        (c) =>
          `<li class="${isLowConfidence(c) ? "lowconf" : ""}"><span class="cap">${esc(c.name)}</span>` +
          `<span class="badge ${band(c.confidence)}">${esc(badge(c))}</span></li>`,
      )
      .join("\n");
    return `<div class="area"><h3>${esc(g.area)}/</h3><ul>${items}</ul></div>`;
  });
  return blocks.join("\n");
}

function mermaidBlock(src: string): string {
  return `<pre class="mermaid">${esc(src)}</pre>`;
}

export function renderHtml(model: ArchitectureModel): string {
  const ctx = mermaidBlock(contextDiagram(model));
  const comp = mermaidBlock(componentDiagram(model));
  const flow = model.flows[0];
  const seq = flow ? mermaidBlock(sequenceDiagram(flow, model)) : "<p class='empty'>No flow derived.</p>";
  const proc = model.processes[0];
  const bpmn = proc ? bpmnXml(proc) : "";
  const erd = model.dataEntities?.length ? mermaidBlock(erDiagram(model)) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Archmantic — ${esc(model.project)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; background: #0f1115; color: #e6e9ef; }
  header { padding: 28px 32px 8px; }
  header h1 { margin: 0; font-size: 22px; }
  header .sub { color: #8b93a7; font-size: 13px; margin-top: 4px; }
  main { padding: 8px 32px 64px; max-width: 1100px; }
  section.trust { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; background: #171a21; border: 1px solid #232734; border-radius: 12px; padding: 16px 20px; margin: 16px 0 8px; }
  .stat { font-size: 13px; color: #8b93a7; } .stat .num { font-size: 20px; color: #e6e9ef; font-weight: 600; margin-right: 6px; }
  .bands { margin-left: auto; display: flex; gap: 8px; }
  .b { font-size: 12px; padding: 3px 9px; border-radius: 999px; }
  .b.high { background: #14331f; color: #4ade80; } .b.medium { background: #33300f; color: #facc15; } .b.low { background: #331616; color: #f87171; }
  h2 { font-size: 16px; margin: 32px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #232734; }
  .card { background: #171a21; border: 1px solid #232734; border-radius: 12px; padding: 18px; overflow: auto; }
  .capgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
  .area h3 { margin: 0 0 8px; font-size: 13px; color: #8b93a7; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .area ul { list-style: none; margin: 0; padding: 0; }
  .area li { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 6px 0; border-bottom: 1px solid #1f232e; }
  .area li.lowconf .cap::after { content: " ⚠"; }
  .cap { font-weight: 500; }
  .badge { font-size: 11px; color: #8b93a7; white-space: nowrap; }
  .badge.low { color: #f87171; } .badge.medium { color: #facc15; } .badge.high { color: #4ade80; }
  .empty { color: #8b93a7; font-style: italic; }
  table.api { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.api th { text-align: left; color: #8b93a7; font-weight: 600; padding: 6px 10px; border-bottom: 1px solid #232734; }
  table.api td { padding: 6px 10px; border-bottom: 1px solid #1f232e; }
  table.api td.path { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  table.api td.proto { color: #8b93a7; }
  td.method { font-family: ui-monospace, monospace; font-weight: 600; white-space: nowrap; }
  td.method.m-get { color: #4ade80; } td.method.m-post { color: #facc15; }
  td.method.m-put, td.method.m-patch { color: #60a5fa; } td.method.m-delete { color: #f87171; }
  td.method.m-query { color: #4ade80; } td.method.m-mutation { color: #facc15; }
  #bpmn { height: 420px; background: #fff; border-radius: 12px; }
  footer { color: #5a6172; font-size: 12px; padding: 0 32px 40px; }
</style>
</head>
<body>
<header>
  <h1>${esc(model.project)}</h1>
  <div class="sub">Living architecture model · generated ${esc(model.generatedAt ?? "")} · every element grounded in code</div>
</header>
<main>
  ${trustBanner(model)}

  <h2>Capability map — what can this system do?</h2>
  <div class="capgrid">${capabilitySection(model)}</div>

  <h2>Context</h2>
  <div class="card">${ctx}</div>

  <h2>Components &amp; dependencies</h2>
  <div class="card">${comp}</div>

  ${erd ? `<h2>Data model — ${model.dataEntities.length} entities</h2>\n  <div class="card">${erd}</div>` : ""}

  ${apiSection(model)}

  <h2>Sequence — ${esc(flow?.name ?? "")}</h2>
  <div class="card">${seq}</div>

  <h2>Process (BPMN) — ${esc(proc?.name ?? "")}</h2>
  <div class="card"><div id="bpmn"></div></div>
</main>
<footer>Archmantic · diagrams are projections of one grounded model · ⚠ = low confidence, flagged for review</footer>

<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: true, theme: "dark", securityLevel: "loose" });
</script>
<script src="https://unpkg.com/bpmn-js@17/dist/bpmn-navigated-viewer.development.js"></script>
<script>
  const BPMN_XML = ${JSON.stringify(bpmn)};
  if (BPMN_XML && window.BpmnJS) {
    const viewer = new BpmnJS({ container: "#bpmn" });
    viewer.importXML(BPMN_XML).then(() => viewer.get("canvas").zoom("fit-viewport")).catch(console.error);
  }
</script>
</body>
</html>
`;
}
