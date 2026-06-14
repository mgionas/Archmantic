"use client";

import { useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import { useFlowProps, GraphDrawer, DrawerSection } from "./flow-graph";
import { cn } from "@/lib/utils";
import type { ContextNode, ContextEdge, ContextDetail } from "@/lib/diagrams";

const SYS_W = 220;
const SYS_H = 56;
const EXT_W = 180;
const EXT_H = 40;

function CtxNode({ data, selected }: NodeProps & { data: { label: string; kind: "system" | "external" } }) {
  const system = data.kind === "system";
  return (
    <div
      className={cn(
        "grid place-items-center rounded-lg border px-3 text-center text-xs transition-colors",
        system ? "bg-primary/10 font-semibold text-foreground" : "bg-card text-card-foreground",
        selected ? "border-primary ring-1 ring-primary" : system ? "border-primary/40" : "border-border",
      )}
      style={{ width: system ? SYS_W : EXT_W, height: system ? SYS_H : EXT_H, borderStyle: system ? "solid" : "dashed" }}
    >
      <Handle type="target" position={Position.Left} className="!size-1.5 !border-0 !bg-border" />
      <span className="truncate">{data.label}</span>
      <Handle type="source" position={Position.Right} className="!size-1.5 !border-0 !bg-border" />
    </div>
  );
}
const nodeTypes = { ctx: CtxNode };

function layout(graph: { nodes: ContextNode[]; edges: ContextEdge[] }): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 18, ranksep: 120 });
  for (const n of graph.nodes) {
    const sys = n.kind === "system";
    g.setNode(n.id, { width: sys ? SYS_W : EXT_W, height: sys ? SYS_H : EXT_H });
  }
  for (const e of graph.edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  return graph.nodes.map((n) => {
    const p = g.node(n.id);
    const sys = n.kind === "system";
    return {
      id: n.id,
      type: "ctx",
      position: { x: p.x - (sys ? SYS_W : EXT_W) / 2, y: p.y - (sys ? SYS_H : EXT_H) / 2 },
      data: { label: n.label, kind: n.kind },
    };
  });
}

function Graph({
  graph,
  details,
  onNavigate,
}: {
  graph: { nodes: ContextNode[]; edges: ContextEdge[] };
  details: Record<string, ContextDetail>;
  onNavigate?: (facet: string) => void;
}) {
  const flow = useFlowProps();
  const [selected, setSelected] = useState<string | null>(null);
  const nodes = useMemo(() => layout(graph), [graph]);
  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: "depends on",
        markerEnd: { type: MarkerType.ArrowClosed },
      })),
    [graph],
  );
  const d = selected ? details[selected] : null;

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        {...flow}
        nodes={nodes.map((n) => (n.id === selected ? { ...n, selected: true } : n))}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_e, node) => setSelected(node.id)}
        onPaneClick={() => setSelected(null)}
        defaultEdgeOptions={{ style: { stroke: "var(--border)" } }}
      >
        <Background gap={18} />
        <MiniMap pannable zoomable />
        <Controls showInteractive={false} />
      </ReactFlow>

      {d ? (
        <GraphDrawer title={d.label} subtitle={d.kind} onClose={() => setSelected(null)}>
          {d.kind === "external" ? (
            <DrawerSection title={`Used by (${d.usedBy.length})`}>
              {d.usedBy.length ? (
                <ul className="space-y-0.5 font-mono text-[11px]">
                  {d.usedBy.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
              {onNavigate ? (
                <button type="button" onClick={() => onNavigate("components")} className="mt-1 text-xs text-primary hover:underline">
                  Open Components →
                </button>
              ) : null}
            </DrawerSection>
          ) : (
            <p className="text-sm text-muted-foreground">The internal system. Open the Components view for its modules.</p>
          )}
        </GraphDrawer>
      ) : null}
    </div>
  );
}

export function ContextGraph(props: {
  graph: { nodes: ContextNode[]; edges: ContextEdge[] };
  details: Record<string, ContextDetail>;
  onNavigate?: (facet: string) => void;
}) {
  return (
    <div className="h-full w-full overflow-hidden rounded-lg border border-border/60 bg-canvas">
      <ReactFlowProvider>
        <Graph {...props} />
      </ReactFlowProvider>
    </div>
  );
}
