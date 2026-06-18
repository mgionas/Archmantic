/**
 * Semantic grouping — the missing middle level between "the whole repo" and "every
 * file." Derives two orthogonal axes deterministically (the AI curation pass renames
 * / merges / describes them later):
 *   - **domain** (a component's `groupId`): the cluster it lives in spatially —
 *     the workspace package (monorepo) or the first meaningful path segment.
 *   - **layer**: an architectural rank from the component's role (Presentation → Data).
 *
 * These power the Architecture Map (C4 L1/L2): graphs cluster by domain and rank by
 * layer instead of rendering a flat file hairball. Cheapest signal first; grounded.
 */
import { type ArchitectureModel, type Group } from "../ir/types.js";
import { humanize } from "../ir/naming.js";
import { packageOf } from "./workspaces.js";

const DOMAIN_CONFIDENCE = 0.85;
const LAYER_CONFIDENCE = 0.8;

/** role → architectural layer (name + display order, presentation-first). */
const LAYER_OF: Record<string, { layer: string; order: number }> = {
  page: { layer: "Presentation", order: 0 },
  layout: { layer: "Presentation", order: 0 },
  ui: { layer: "Presentation", order: 0 },
  modal: { layer: "Presentation", order: 0 },
  view: { layer: "Presentation", order: 0 },
  route: { layer: "API", order: 1 },
  middleware: { layer: "API", order: 1 },
  hook: { layer: "State", order: 2 },
  store: { layer: "State", order: 2 },
  service: { layer: "Domain", order: 3 },
  util: { layer: "Domain", order: 3 },
  module: { layer: "Domain", order: 3 },
  model: { layer: "Data", order: 4 },
  config: { layer: "Config", order: 5 },
};
const layerFor = (role: string) => LAYER_OF[role] ?? LAYER_OF.module!;

/** The domain key for a file: its workspace package, else the first meaningful folder. */
function domainKey(rel: string, members: string[]): string {
  const pkg = packageOf(rel, members);
  if (pkg) return pkg;
  const parts = rel.split("/");
  let i = 0;
  if (["src", "app", "lib", "source", "pkg"].includes(parts[0]!)) i = 1;
  if (parts[0] === "resources" && (parts[1] === "js" || parts[1] === "ts")) i = 2;
  // a folder after the root segment is the domain; a top-level file → "root"
  return parts.length > i + 1 ? parts[i]! : "root";
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "group";

/**
 * Derive domain + layer groups over the model's components (idempotent — clears and
 * rebuilds `model.groups`). Sets each component's `groupId` to its domain group.
 * Singleton domains collapse into "misc" so the map shows clusters, not confetti.
 */
export function deriveGroups(model: ArchitectureModel, members: string[]): void {
  model.groups = [];
  for (const c of model.components) delete c.groupId;
  if (!model.components.length) return;

  // 1. Bucket components by raw domain key + by layer.
  const domainOf = new Map<string, string>(); // componentId → domain key
  const byDomain = new Map<string, string[]>();
  const byLayer = new Map<string, { ids: string[]; order: number }>();
  for (const c of model.components) {
    const rel = c.id.replace(/^comp:/, "");
    const dkey = domainKey(rel, members);
    domainOf.set(c.id, dkey);
    (byDomain.get(dkey) ?? byDomain.set(dkey, []).get(dkey)!).push(c.id);
    const { layer, order } = layerFor(c.role ?? "module");
    const bucket = byLayer.get(layer) ?? byLayer.set(layer, { ids: [], order }).get(layer)!;
    bucket.ids.push(c.id);
  }

  // 2. Collapse singleton domains into "misc" (clusters, not confetti).
  const hasMisc = [...byDomain.values()].some((m) => m.length < 2);
  if (hasMisc) {
    const misc: string[] = [];
    for (const [k, ids] of [...byDomain.entries()]) {
      if (ids.length < 2 && k !== "misc") {
        misc.push(...ids);
        for (const id of ids) domainOf.set(id, "misc");
        byDomain.delete(k);
      }
    }
    if (misc.length) byDomain.set("misc", [...(byDomain.get("misc") ?? []), ...misc]);
  }

  // 3. Domain groups + component.groupId (grounded to a representative member file).
  const domainId = new Map<string, string>();
  for (const [dkey, ids] of byDomain) {
    const id = `group:domain:${slug(dkey)}`;
    domainId.set(dkey, id);
    const ref = ids[0]!.replace(/^comp:/, "");
    model.groups.push({
      id,
      name: dkey === "root" ? "Root" : dkey === "misc" ? "Misc" : humanize(dkey),
      kind: "domain",
      members: [...ids].sort(),
      provenance: [{ source: "code", ref, confidence: DOMAIN_CONFIDENCE }],
      confidence: DOMAIN_CONFIDENCE,
    });
  }
  for (const c of model.components) c.groupId = domainId.get(domainOf.get(c.id)!);

  // 4. Layer groups (the orthogonal rank axis for the map's vertical banding).
  for (const [layer, { ids, order }] of byLayer) {
    model.groups.push({
      id: `group:layer:${slug(layer)}`,
      name: layer,
      kind: "layer",
      members: [...ids].sort(),
      order,
      provenance: [{ source: "code", ref: `derived:layer:${slug(layer)}`, confidence: LAYER_CONFIDENCE }],
      confidence: LAYER_CONFIDENCE,
    });
  }
}
