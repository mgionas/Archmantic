"use client";

import { useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
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
import { useFlowProps, GraphDrawer, DrawerSection, focusDuration } from "./flow-graph";
import { cn } from "@/lib/utils";
import type { EntityNode as EntityNodeData, EntityEdge, EntityField } from "@/lib/diagrams";

const EW = 216;
const HEADER = 28;
const ROW = 18;
const MAX_ROWS = 9;
const keyColor: Record<string, string> = { PK: "#4ade80", FK: "#60a5fa", UK: "#fbbf24" };

function nodeHeight(fieldCount: number): number {
  return HEADER + Math.min(fieldCount, MAX_ROWS) * ROW + 8;
}

function EntityCard({ data, selected }: NodeProps & { data: { label: string; fields: EntityField[] } }) {
  const shown = data.fields.slice(0, MAX_ROWS);
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card text-card-foreground",
        selected ? "border-primary ring-1 ring-primary" : "border-border",
      )}
      style={{ width: EW }}
    >
      <Handle type="target" position={Position.Top} className="!size-1.5 !border-0 !bg-border" />
      <div className="border-b border-border/60 bg-muted/40 px-2 py-1 text-xs font-semibold">{data.label}</div>
      <div className="px-2 py-1">
        {shown.map((f) => (
          <div key={f.name} className="flex items-center gap-1.5 text-[11px] leading-[18px]">
            {f.key ? (
              <span className="font-mono font-bold" style={{ color: keyColor[f.key] }}>
                {f.key}
              </span>
            ) : (
              <span className="w-[18px]" />
            )}
            <span className="truncate font-mono">{f.name}</span>
            <span className="ml-auto truncate text-muted-foreground">{f.type}</span>
          </div>
        ))}
        {data.fields.length > MAX_ROWS ? (
          <div className="text-[11px] text-muted-foreground">+{data.fields.length - MAX_ROWS} more</div>
        ) : null}
      </div>
      <Handle type="source" position={Position.Bottom} className="!size-1.5 !border-0 !bg-border" />
    </div>
  );
}
const nodeTypes = { entity: EntityCard };

function layout(graph: { nodes: EntityNodeData[]; edges: EntityEdge[] }): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 28, ranksep: 90 });
  for (const n of graph.nodes) g.setNode(n.id, { width: EW, height: nodeHeight(n.fields.length) });
  for (const e of graph.edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  return graph.nodes.map((n) => {
    const p = g.node(n.id);
    return {
      id: n.id,
      type: "entity",
      position: { x: p.x - EW / 2, y: p.y - nodeHeight(n.fields.length) / 2 },
      data: { label: n.label, fields: n.fields },
    };
  });
}

function Graph({ graph }: { graph: { nodes: EntityNodeData[]; edges: EntityEdge[] } }) {
  const flow = useFlowProps();
  const rf = useReactFlow();
  const [selected, setSelected] = useState<string | null>(null);
  const nodes = useMemo(() => layout(graph), [graph]);
  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        markerEnd: { type: MarkerType.ArrowClosed },
      })),
    [graph],
  );
  const labelById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n.label])), [graph]);
  const node = selected ? graph.nodes.find((n) => n.id === selected) : null;
  const relations = useMemo(() => {
    if (!selected) return [];
    return graph.edges
      .filter((e) => e.source === selected || e.target === selected)
      .map((e) => {
        const other = e.source === selected ? e.target : e.source;
        return { id: other, label: labelById.get(other) ?? other, card: e.label };
      });
  }, [graph, selected, labelById]);

  const focus = (id: string) => {
    setSelected(id);
    rf.fitView({ nodes: [{ id }], duration: focusDuration(), maxZoom: 1.2 });
  };

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        {...flow}
        nodes={nodes.map((n) => (n.id === selected ? { ...n, selected: true } : n))}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_e, n) => setSelected(n.id)}
        onPaneClick={() => setSelected(null)}
        defaultEdgeOptions={{ style: { stroke: "var(--border)" } }}
      >
        <Background gap={18} />
        <MiniMap pannable zoomable />
        <Controls showInteractive={false} />
      </ReactFlow>

      {node ? (
        <GraphDrawer title={node.label} subtitle={node.ref} onClose={() => setSelected(null)}>
          <DrawerSection title={`Fields (${node.fields.length})`}>
            <ul className="space-y-0.5 text-[11px]">
              {node.fields.map((f) => (
                <li key={f.name} className="flex items-center gap-1.5 font-mono">
                  {f.key ? <span style={{ color: keyColor[f.key] }}>{f.key}</span> : <span className="w-[18px]" />}
                  <span>{f.name}</span>
                  <span className="ml-auto text-muted-foreground">
                    {f.type}
                    {f.optional ? "?" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </DrawerSection>
          <DrawerSection title={`Relations (${relations.length})`}>
            {relations.length ? (
              <div className="flex flex-wrap gap-1">
                {relations.map((r) => (
                  <button
                    key={`${r.id}-${r.card}`}
                    type="button"
                    onClick={() => focus(r.id)}
                    className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[11px] hover:border-primary/50 hover:text-foreground"
                  >
                    {r.label} <span className="text-muted-foreground">{r.card}</span>
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </DrawerSection>
        </GraphDrawer>
      ) : null}
    </div>
  );
}

export function EntityGraph(props: { graph: { nodes: EntityNodeData[]; edges: EntityEdge[] } }) {
  return (
    <div className="h-full w-full overflow-hidden rounded-lg border border-border/60 bg-canvas">
      <ReactFlowProvider>
        <Graph {...props} />
      </ReactFlowProvider>
    </div>
  );
}
