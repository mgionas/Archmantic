"use client";

import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
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
import { X } from "lucide-react";
import "@xyflow/react/dist/style.css";
import type { GraphNode, GraphEdge, CompDetail } from "@/lib/diagrams";
import { cn } from "@/lib/utils";
import { roleColor } from "@/lib/format";
import { focusDuration } from "@/components/flow-graph";
import { SegmentedControl } from "@/components/ui/segmented-control";

const NW = 188;
const NH = 38;
const GAP_X = 16;
const GAP_Y = 12;
const PAD_X = 12;
const PAD_TOP = 30;
const PAD_BOTTOM = 12;

function CompNode({ data, selected }: NodeProps & { data: { label: string; role: string } }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-xs text-card-foreground transition-colors",
        selected ? "border-primary ring-1 ring-primary" : "border-border",
      )}
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

function AreaGroupNode({ data }: NodeProps & { data: { label: string } }) {
  return (
    <div className="h-full w-full rounded-xl border border-border/60 bg-muted/20">
      <div className="px-3 py-1 font-mono text-[11px] text-muted-foreground">{data.label}</div>
    </div>
  );
}
const nodeTypes = { areaGroup: AreaGroupNode, comp: CompNode };

type GroupBy = "folder" | "role";

function folderOf(n: GraphNode): string {
  if (n.kind === "external") return "external";
  const path = n.id.replace(/^comp:/, "");
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "." : path.slice(0, slash);
}
const keyOf = (n: GraphNode, by: GroupBy) => (by === "role" ? n.role : folderOf(n));
const labelOf = (key: string, by: GroupBy) => (by === "folder" ? `${key}/` : key);

function buildLayout(graph: { nodes: GraphNode[]; edges: GraphEdge[] }, by: GroupBy): Node[] {
  const groups = new Map<string, GraphNode[]>();
  for (const n of graph.nodes) {
    const k = keyOf(n, by);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(n);
  }
  const dims = new Map<string, { w: number; h: number; cols: number }>();
  for (const [k, members] of groups) {
    const cols = Math.max(1, Math.ceil(Math.sqrt(members.length)));
    const rows = Math.ceil(members.length / cols);
    dims.set(k, {
      cols,
      w: PAD_X * 2 + cols * NW + (cols - 1) * GAP_X,
      h: PAD_TOP + rows * NH + (rows - 1) * GAP_Y + PAD_BOTTOM,
    });
  }
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 48, ranksep: 80 });
  for (const [k, d] of dims) g.setNode(k, { width: d.w, height: d.h });
  const keyById = new Map(graph.nodes.map((n) => [n.id, keyOf(n, by)]));
  const seen = new Set<string>();
  for (const e of graph.edges) {
    const a = keyById.get(e.source);
    const b = keyById.get(e.target);
    if (!a || !b || a === b || seen.has(`${a} ${b}`)) continue;
    seen.add(`${a} ${b}`);
    g.setEdge(a, b);
  }
  dagre.layout(g);

  const out: Node[] = [];
  for (const [k, d] of dims) {
    const p = g.node(k);
    out.push({
      id: `group:${k}`,
      type: "areaGroup",
      position: { x: p.x - d.w / 2, y: p.y - d.h / 2 },
      data: { label: labelOf(k, by) },
      draggable: false,
      selectable: false,
      style: { width: d.w, height: d.h },
    });
  }
  for (const [k, members] of groups) {
    const cols = dims.get(k)!.cols;
    members.forEach((m, i) => {
      out.push({
        id: m.id,
        type: "comp",
        parentId: `group:${k}`,
        extent: "parent",
        position: { x: PAD_X + (i % cols) * (NW + GAP_X), y: PAD_TOP + Math.floor(i / cols) * (NH + GAP_Y) },
        data: { label: m.label, role: m.role },
      });
    });
  }
  return out;
}

function ChipList({ items, onClick }: { items: { id: string; label: string }[]; onClick: (id: string) => void }) {
  if (!items.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((d) => (
        <button
          key={d.id}
          type="button"
          onClick={() => onClick(d.id)}
          className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] hover:border-primary/50 hover:text-foreground"
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

function DetailPanel({
  detail,
  onClose,
  onSelect,
  onNavigate,
}: {
  detail: CompDetail;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNavigate?: (facet: string) => void;
}) {
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{title}</div>
      {children}
    </div>
  );
  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-80 flex-col gap-4 overflow-auto border-l border-border/60 bg-card/95 p-4 backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: roleColor(detail.role) }} />
            <span className="truncate font-semibold">{detail.label}</span>
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{detail.ref}</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      <span className="w-fit rounded-md bg-muted px-1.5 py-0.5 text-xs capitalize">{detail.role}</span>

      {detail.responsibility ? <p className="text-sm text-muted-foreground">{detail.responsibility}</p> : null}

      <Section title={`Depends on (${detail.dependsOn.length})`}>
        <ChipList items={detail.dependsOn} onClick={onSelect} />
      </Section>
      <Section title={`Used by (${detail.usedBy.length})`}>
        <ChipList items={detail.usedBy} onClick={onSelect} />
      </Section>

      {detail.capabilities.length ? (
        <Section title="Capabilities">
          <ul className="space-y-0.5 text-sm">
            {detail.capabilities.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {onNavigate ? (
            <button type="button" onClick={() => onNavigate("capabilities")} className="mt-1 text-xs text-primary hover:underline">
              Open Capabilities →
            </button>
          ) : null}
        </Section>
      ) : null}

      {detail.endpoints.length ? (
        <Section title="Endpoints">
          <ul className="space-y-0.5 font-mono text-xs">
            {detail.endpoints.map((e) => (
              <li key={`${e.method} ${e.path}`}>
                <span className="text-muted-foreground">{e.method}</span> {e.path}
              </li>
            ))}
          </ul>
          {onNavigate ? (
            <button type="button" onClick={() => onNavigate("api")} className="mt-1 text-xs text-primary hover:underline">
              Open API →
            </button>
          ) : null}
        </Section>
      ) : null}

      {detail.entities.length ? (
        <Section title="Data entities">
          <ul className="space-y-0.5 text-sm">
            {detail.entities.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          {onNavigate ? (
            <button type="button" onClick={() => onNavigate("data")} className="mt-1 text-xs text-primary hover:underline">
              Open Data →
            </button>
          ) : null}
        </Section>
      ) : null}
    </div>
  );
}

function Graph({
  graph,
  details,
  onNavigate,
}: {
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  details: Record<string, CompDetail>;
  onNavigate?: (facet: string) => void;
}) {
  const { resolvedTheme } = useTheme();
  const rf = useReactFlow();
  const [by, setBy] = useState<GroupBy>("folder");
  const [selected, setSelected] = useState<string | null>(null);
  const nodes = useMemo(() => buildLayout(graph, by), [graph, by]);
  const edges = useMemo<Edge[]>(
    () => graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, markerEnd: { type: MarkerType.ArrowClosed } })),
    [graph],
  );
  const rolesPresent = useMemo(() => [...new Set(graph.nodes.map((n) => n.role))].sort(), [graph]);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const roleById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n.role])), [graph]);

  const focus = (id: string) => {
    setSelected(id);
    rf.fitView({ nodes: [{ id }], duration: focusDuration(), maxZoom: 1.4 });
  };

  const decorated = nodes.map((n) => {
    if (n.type !== "comp") return n;
    const dim = roleFilter !== null && roleById.get(n.id) !== roleFilter;
    return { ...n, selected: n.id === selected, style: { ...(n.style ?? {}), opacity: dim ? 0.25 : 1 } };
  });

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={decorated}
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
        onNodeClick={(_e, node) => {
          if (node.type === "comp") setSelected(node.id);
        }}
        onPaneClick={() => setSelected(null)}
        defaultEdgeOptions={{ style: { stroke: "var(--border)" } }}
      >
        <Panel position="top-left" className="rounded-lg bg-background/80 backdrop-blur">
          <SegmentedControl options={["folder", "role"] as const} value={by} onChange={setBy} />
        </Panel>
        <Panel position="top-right" className="flex max-w-[40%] flex-wrap justify-end gap-x-2 gap-y-1 rounded-lg border border-border/60 bg-background/80 px-2 py-1.5 backdrop-blur">
          {rolesPresent.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter((cur) => (cur === r ? null : r))}
              title={roleFilter === r ? "Show all" : `Highlight ${r}`}
              className={cn(
                "flex items-center gap-1.5 rounded px-1 text-[11px] transition-opacity",
                roleFilter !== null && roleFilter !== r ? "opacity-40" : "text-muted-foreground hover:text-foreground",
                roleFilter === r && "font-medium text-foreground",
              )}
            >
              <span className="size-2 rounded-full" style={{ background: roleColor(r) }} />
              {r}
            </button>
          ))}
        </Panel>
        <Background gap={18} />
        <MiniMap pannable zoomable />
        <Controls showInteractive={false} />
      </ReactFlow>

      {selected && details[selected] ? (
        <DetailPanel detail={details[selected]} onClose={() => setSelected(null)} onSelect={focus} onNavigate={onNavigate} />
      ) : null}
    </div>
  );
}

export function ComponentGraph(props: {
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  details: Record<string, CompDetail>;
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
