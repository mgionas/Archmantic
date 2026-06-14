"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import { ReactFlow, Background, Controls, MiniMap, MarkerType, type Node, type Edge } from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import "@xyflow/react/dist/style.css";
import type { GraphNode, GraphEdge } from "@/lib/diagrams";

const NW = 184;
const NH = 40;

/** Auto-layout the component graph top-to-bottom with dagre, → React Flow nodes. */
function layoutNodes(nodes: GraphNode[], edges: GraphEdge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 36, ranksep: 64 });
  nodes.forEach((n) => g.setNode(n.id, { width: NW, height: NH }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    const external = n.kind === "external";
    return {
      id: n.id,
      position: { x: p.x - NW / 2, y: p.y - NH / 2 },
      data: { label: n.label },
      style: {
        width: NW,
        fontSize: 12,
        padding: "8px 10px",
        borderRadius: 8,
        border: external ? "1px dashed var(--border)" : "1px solid var(--border)",
        background: "var(--card)",
        color: external ? "var(--muted-foreground)" : "var(--card-foreground)",
      },
    } satisfies Node;
  });
}

/**
 * React Flow spike for the component dependency graph. Native pan/zoom/minimap and
 * Google-Maps gestures (two-finger trackpad pan, pinch zoom); scales to large
 * graphs better than the static Mermaid SVG. A/B against the Mermaid views.
 */
export function ComponentGraph({ graph }: { graph: { nodes: GraphNode[]; edges: GraphEdge[] } }) {
  const { resolvedTheme } = useTheme();
  const nodes = useMemo(() => layoutNodes(graph.nodes, graph.edges), [graph]);
  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        markerEnd: { type: MarkerType.ArrowClosed },
      })),
    [graph],
  );

  return (
    <div className="h-full w-full overflow-hidden rounded-lg border border-border/60 bg-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        minZoom={0.1}
        maxZoom={4}
        colorMode={resolvedTheme === "light" ? "light" : "dark"}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        panOnDrag
        nodesConnectable={false}
        defaultEdgeOptions={{ style: { stroke: "var(--border)" } }}
      >
        <Background gap={18} />
        <MiniMap pannable zoomable />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
