"use client";

import { useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  MarkerType,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import { Maximize2, ArrowRight, Boxes } from "lucide-react";
import { useFlowProps, GraphDrawer, DrawerSection, focusDuration, EDGE_LABEL, useFullscreen } from "./flow-graph";
import { cn } from "@/lib/utils";
import { roleColor } from "@/lib/format";
import type { MapNode, MapEdge } from "@/lib/diagrams";

const DW = 204;
const DH = 66;
const XW = 168;
const XH = 46;

const EXT_COLOR: Record<string, string> = {
  datastore: "#4ade80",
  saas: "#c084fc",
  infra: "#fbbf24",
  service: "#60a5fa",
};
const dims = (n: MapNode) => (n.kind === "domain" ? { w: DW, h: DH } : { w: XW, h: XH });

function DomainCard({ data, selected }: NodeProps & { data: { label: string; count: number; roles: string[]; muted?: boolean } }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-sm border bg-card px-3 py-2 text-card-foreground shadow-sm",
        selected ? "border-primary ring-1 ring-primary" : "border-border",
        // Misc = collapsed singletons: a de-emphasized "leftovers" pile, not a real domain.
        data.muted ? "border-dashed bg-muted/30 opacity-60" : "",
      )}
      style={{ width: DW, height: DH }}
      title={data.muted ? "Ungrouped singletons — not a real domain" : undefined}
    >
      <Handle type="target" position={Position.Top} className="!size-1.5 !border-0 !bg-border" />
      <div className="flex items-center gap-1.5">
        <Boxes className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-semibold">{data.label}</span>
        {data.muted ? <span className="shrink-0 text-[10px] text-muted-foreground">leftovers</span> : null}
        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">{data.count}</span>
      </div>
      <div className="flex items-center gap-1">
        {data.roles.map((r) => (
          <span key={r} className="size-2 rounded-full" style={{ background: roleColor(r) }} title={r} />
        ))}
      </div>
      <Handle type="source" position={Position.Bottom} className="!size-1.5 !border-0 !bg-border" />
    </div>
  );
}

function ExternalNode({ data, selected }: NodeProps & { data: { label: string; externalKind?: string } }) {
  const color = EXT_COLOR[data.externalKind ?? ""] ?? "var(--muted-foreground)";
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-sm border border-dashed bg-card px-3 text-card-foreground",
        selected ? "ring-1 ring-primary" : "",
      )}
      style={{ width: XW, height: XH, borderColor: color }}
    >
      <Handle type="target" position={Position.Top} className="!size-1.5 !border-0 !bg-border" />
      <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">{data.label}</span>
        {data.externalKind ? <span className="block text-[10px] text-muted-foreground">{data.externalKind}</span> : null}
      </span>
    </div>
  );
}

const nodeTypes = { domain: DomainCard, external: ExternalNode };

function layout(graph: { nodes: MapNode[]; edges: MapEdge[] }): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 80 });
  for (const n of graph.nodes) {
    const { w, h } = dims(n);
    g.setNode(n.id, { width: w, height: h });
  }
  for (const e of graph.edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  return graph.nodes.map((n) => {
    const p = g.node(n.id);
    const { w, h } = dims(n);
    return {
      id: n.id,
      type: n.kind,
      position: { x: p.x - w / 2, y: p.y - h / 2 },
      data: { label: n.label, count: n.count, roles: n.roles, externalKind: n.externalKind, muted: n.muted },
    };
  });
}

function Graph({
  graph,
  onOpenDomain,
}: {
  graph: { nodes: MapNode[]; edges: MapEdge[] };
  onOpenDomain?: (domain: { id: string; label: string }) => void;
}) {
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
        label: e.weight > 1 ? `${e.weight}` : undefined,
        markerEnd: { type: MarkerType.ArrowClosed },
        ...EDGE_LABEL,
      })),
    [graph],
  );
  const { ref: fsRef, toggle: toggleFs } = useFullscreen<HTMLDivElement>();
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const node = selected ? byId.get(selected) : null;
  const outgoing = useMemo(
    () => (selected ? graph.edges.filter((e) => e.source === selected).map((e) => byId.get(e.target)).filter(Boolean) : []),
    [graph, selected, byId],
  );
  const incoming = useMemo(
    () => (selected ? graph.edges.filter((e) => e.target === selected).map((e) => byId.get(e.source)).filter(Boolean) : []),
    [graph, selected, byId],
  );
  const focus = (id: string) => {
    setSelected(id);
    rf.fitView({ nodes: [{ id }], duration: focusDuration(), maxZoom: 1.2 });
  };

  return (
    <div
      ref={fsRef}
      className="relative h-full w-full bg-canvas"
      role="group"
      aria-label={`Architecture map — ${graph.nodes.filter((n) => n.kind === "domain").length} domains. Select a domain to see its connections and open its components.`}
    >
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
        <Controls showInteractive={false}>
          <ControlButton onClick={toggleFs} title="Fullscreen" aria-label="Toggle fullscreen">
            <Maximize2 />
          </ControlButton>
        </Controls>
      </ReactFlow>

      {node ? (
        <GraphDrawer
          title={node.label}
          subtitle={node.kind === "domain" ? `${node.count} components` : node.externalKind}
          accent={node.kind === "external" ? EXT_COLOR[node.externalKind ?? ""] : undefined}
          onClose={() => setSelected(null)}
        >
          {node.kind === "domain" && onOpenDomain ? (
            <button
              type="button"
              onClick={() => onOpenDomain({ id: node.id, label: node.label })}
              className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs hover:border-primary/50 hover:text-foreground"
            >
              Open components <ArrowRight className="size-3" />
            </button>
          ) : null}
          <DrawerSection title={`Depends on (${outgoing.length})`}>
            {outgoing.length ? (
              <div className="flex flex-wrap gap-1">
                {outgoing.map((n) => (
                  <button
                    key={n!.id}
                    type="button"
                    onClick={() => focus(n!.id)}
                    className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[11px] hover:border-primary/50 hover:text-foreground"
                  >
                    {n!.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </DrawerSection>
          <DrawerSection title={`Used by (${incoming.length})`}>
            {incoming.length ? (
              <div className="flex flex-wrap gap-1">
                {incoming.map((n) => (
                  <button
                    key={n!.id}
                    type="button"
                    onClick={() => focus(n!.id)}
                    className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[11px] hover:border-primary/50 hover:text-foreground"
                  >
                    {n!.label}
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

export function ArchitectureMap(props: {
  graph: { nodes: MapNode[]; edges: MapEdge[] };
  onOpenDomain?: (domain: { id: string; label: string }) => void;
}) {
  if (!props.graph.nodes.some((n) => n.kind === "domain")) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-border/60 bg-canvas">
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          No domains derived yet. Re-run <code className="rounded bg-muted px-1 py-0.5 text-xs">archmantic analyze</code> and
          push so the map can cluster components into domains.
        </p>
      </div>
    );
  }
  return (
    <div className="h-full w-full overflow-hidden rounded-lg border border-border/60 bg-canvas">
      <ReactFlowProvider>
        <Graph {...props} />
      </ReactFlowProvider>
    </div>
  );
}
