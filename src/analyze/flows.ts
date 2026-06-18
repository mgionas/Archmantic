/**
 * Feature-scoped behavior flows (Spec layer Phase 3).
 *
 * The CLI-style entry-point process derivation (derive.ts) produces nothing for
 * web apps (no single entry that fans out). Instead, derive a behavior flow per
 * feature from its component's import/call subgraph: the page → the components it
 * renders → the external services it calls. Each step is grounded to the import
 * edge's `file:line`. Projects to the per-feature sequence diagram, so app repos
 * finally get sequences/process. See docs/design/SPEC-LAYER.md (Phase 3).
 */
import { type ArchitectureModel, type Flow, type FlowStep, type Process, type Provenance } from "../ir/types.js";
import { componentLabel } from "../ir/naming.js";

const MAX_STEPS = 14;
const FLOW_CONFIDENCE = 0.6;
const lineOf = (ref: string) => Number(ref.split(":").pop()) || 0;

/** Build flows from each feature's component dependency subgraph (richest first). */
export function deriveFeatureFlows(model: ArchitectureModel): Flow[] {
  // Adjacency over import/call edges (component → component or → external system),
  // each neighbour ordered by import line so the sequence reads top-to-bottom.
  const adj = new Map<string, { to: string; ref: string }[]>();
  for (const r of model.relations) {
    const list = adj.get(r.from) ?? adj.set(r.from, []).get(r.from)!;
    list.push({ to: r.to, ref: r.provenance[0]?.ref ?? "" });
  }
  for (const list of adj.values()) list.sort((a, b) => lineOf(a.ref) - lineOf(b.ref));

  const flows: Flow[] = [];
  for (const f of model.features ?? []) {
    const entry = (f.components ?? [])[0];
    if (!entry) continue;

    const visited = new Set<string>();
    const order: string[] = [];
    const steps: FlowStep[] = [];
    const queue: string[] = [entry];
    while (queue.length && order.length < MAX_STEPS) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      order.push(id);
      for (const e of adj.get(id) ?? []) {
        if (steps.length < MAX_STEPS) {
          steps.push({
            participant: id,
            action: e.to.startsWith("sys:ext:") ? "calls" : "renders",
            to: e.to,
            provenance: [{ source: "code", ref: e.ref, confidence: FLOW_CONFIDENCE }],
          });
        }
        if (!visited.has(e.to)) queue.push(e.to);
      }
    }
    if (!steps.length) continue; // a leaf page with no imports → no meaningful flow

    const participants = [...new Set([entry, ...steps.flatMap((s) => [s.participant, s.to!])])];
    const slug = f.id.replace(/^feature:/, "");
    flows.push({
      id: `flow:${slug}`,
      name: `${f.name} flow`,
      description: `Behavior of "${f.name}": the page, the components it renders, and the services it calls.`,
      participants,
      steps,
      featureId: f.id,
      provenance: [{ source: "code", ref: `${entry.replace(/^comp:/, "")}:1`, confidence: FLOW_CONFIDENCE }],
      confidence: FLOW_CONFIDENCE,
    });
  }
  // Richest first so flows[0] (the default sequence projection) is the most informative.
  return flows.sort((a, b) => b.steps.length - a.steps.length);
}

/** Synthesize a linear process from a flow's ordered participants. */
export function processFromFlow(flow: Flow): Process {
  const prov: Provenance = { source: "code", ref: flow.provenance[0]?.ref ?? "?", confidence: FLOW_CONFIDENCE };
  const nameOf = (id: string) => (id.startsWith("comp:") ? componentLabel(id) : id.replace(/^sys:ext:/, ""));
  return {
    id: `proc:${flow.id.replace(/^flow:/, "")}`,
    name: flow.name.replace(/ flow$/, " process"),
    description: flow.description,
    tasks: flow.participants.slice(0, MAX_STEPS).map((id) => ({ id: `task:${id}`, name: nameOf(id), provenance: [prov] })),
    provenance: [prov],
    confidence: FLOW_CONFIDENCE,
  };
}
