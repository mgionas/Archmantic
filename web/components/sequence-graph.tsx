"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  Panel,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import "@xyflow/react/dist/style.css";
import type { GraphNode, FlowEdge } from "@/lib/diagrams";
import { roleColor } from "@/lib/format";
import { RoleLegend } from "@/components/ui/role-legend";

const NW = 200;
const NH = 40;

function StepNode({ data }: NodeProps & { data: { label: string; role: string } }) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-card-foreground"
      style={{ width: NW }}
      title={`${data.label} · ${data.role}`}
    >
      <Handle type="target" position={Position.Top} className="!size-1.5 !border-0 !bg-border" />
      <span className="size-2 shrink-0 rounded-full" style={{ background: roleColor(data.role) }} />
      <span className="truncate">{data.label}</span>
      <Handle type="source" position={Position.Bottom} className="!size-1.5 !border-0 !bg-border" />
    </div>
  );
}
const nodeTypes = { step: StepNode };

function layout(graph: { nodes: GraphNode[]; edges: FlowEdge[] }, rankdir: "TB" | "LR"): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir, nodesep: 40, ranksep: rankdir === "LR" ? 96 : 64 });
  for (const n of graph.nodes) g.setNode(n.id, { width: NW, height: NH });
  for (const e of graph.edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  return graph.nodes.map((n) => {
    const p = g.node(n.id);
    return { id: n.id, type: "step", position: { x: p.x - NW / 2, y: p.y - NH / 2 }, data: { label: n.label, role: n.role } };
  });
}

function Graph({ graph, rankdir }: { graph: { nodes: GraphNode[]; edges: FlowEdge[] }; rankdir: "TB" | "LR" }) {
  const { resolvedTheme } = useTheme();
  const nodes = useMemo(() => layout(graph, rankdir), [graph, rankdir]);
  const rolesPresent = useMemo(() => [...new Set(graph.nodes.map((n) => n.role))].sort(), [graph]);
  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        labelBgPadding: [4, 2],
        labelBgStyle: { fill: "var(--background)", fillOpacity: 0.85 },
        markerEnd: { type: MarkerType.ArrowClosed },
      })),
    [graph],
  );
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.05}
      maxZoom={4}
      colorMode={resolvedTheme === "light" ? "light" : "dark"}
      panOnScroll
      zoomOnScroll={false}
      zoomOnPinch
      panOnDrag
      nodesConnectable={false}
      defaultEdgeOptions={{ style: { stroke: "var(--border)" } }}
    >
      <Panel position="top-right" className="rounded-lg border border-border/60 bg-background/80 px-2 py-1.5 backdrop-blur">
        <RoleLegend roles={rolesPresent} className="max-w-[40vw] justify-end" />
      </Panel>
      <Background gap={18} />
      <MiniMap pannable zoomable />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export function SequenceGraph({
  graph,
  rankdir = "TB",
}: {
  graph: { nodes: GraphNode[]; edges: FlowEdge[] };
  rankdir?: "TB" | "LR";
}) {
  return (
    <div className="h-full w-full overflow-hidden rounded-lg border border-border/60 bg-canvas">
      <ReactFlowProvider>
        <Graph graph={graph} rankdir={rankdir} />
      </ReactFlowProvider>
    </div>
  );
}
