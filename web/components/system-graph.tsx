"use client";

import dynamic from "next/dynamic";
import type { GraphNode, FlowEdge } from "@/lib/diagrams";

// Reuse the labeled directed-graph renderer (xyflow); ssr:false (needs the DOM).
const SequenceGraph = dynamic(() => import("./sequence-graph").then((m) => m.SequenceGraph), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading graph…</div>,
});

export function SystemGraph({ graph }: { graph: { nodes: GraphNode[]; edges: FlowEdge[] } }) {
  return <SequenceGraph graph={graph} />;
}
