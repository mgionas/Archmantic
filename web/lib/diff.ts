import type { Model } from "./store";

/** Lightweight architecture delta between two stored models (for the commit timeline). */
export interface Delta {
  components: { added: string[]; removed: string[] };
  capabilities: { added: string[]; removed: string[] };
  externals: { added: string[]; removed: string[] };
  total: number;
}

function diffSets(base: string[], head: string[]) {
  const b = new Set(base);
  const h = new Set(head);
  return {
    added: head.filter((x) => !b.has(x)),
    removed: base.filter((x) => !h.has(x)),
  };
}

export function modelDelta(base: Model | null, head: Model): Delta {
  const ids = (m: Model | null, sel: (m: Model) => { id: string }[]) => (m ? sel(m).map((e) => e.id) : []);
  const externalIds = (m: Model | null) =>
    m ? m.systems.filter((s) => s.kind === "external").map((s) => s.id) : [];

  const components = diffSets(ids(base, (m) => m.components), head.components.map((c) => c.id));
  const capabilities = diffSets(ids(base, (m) => m.capabilities), head.capabilities.map((c) => c.id));
  const externals = diffSets(externalIds(base), externalIds(head));
  const total =
    components.added.length +
    components.removed.length +
    capabilities.added.length +
    capabilities.removed.length +
    externals.added.length +
    externals.removed.length;
  return { components, capabilities, externals, total };
}
