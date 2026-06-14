"use client";

import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Maximize2 } from "lucide-react";
import "@xyflow/react/dist/style.css";
import type { SequenceModel } from "@/lib/diagrams";
import { roleColor } from "@/lib/format";
import { useFullscreen } from "@/components/flow-graph";
import { RoleLegend } from "@/components/ui/role-legend";
import { SegmentedControl } from "@/components/ui/segmented-control";

// Lifeline + message geometry. A real sequence diagram: participants are columns,
// time flows downward, each step is a horizontal labeled message at its own row.
const COL = 240; // horizontal spacing between participant lifelines
const PART_W = 188; // participant header width
const PART_H = 40;
const HEAD_Y = 8;
const LIFE_TOP = HEAD_Y + PART_H + 18; // where dashed lifelines begin
const ROW = 74; // vertical spacing between messages
const MSG_H = 46;
const FIRST_MSG = LIFE_TOP + 30; // center y of the first message
const LIFE_W = 16;

const cx = (i: number) => i * COL + COL / 2;
const rowCenter = (j: number) => FIRST_MSG + j * ROW;

/** Activation spans for one participant: a bar from when it receives a call until
 *  it next sends one (classic activation lifetime). Approximate but reads right. */
function activationSpans(messages: SequenceModel["messages"], pid: string): [number, number][] {
  const spans: [number, number][] = [];
  let open: number | null = null;
  messages.forEach((m, j) => {
    const received = m.to === pid && !m.self;
    const sent = m.from === pid;
    if (open === null && received) open = j;
    else if (open !== null && sent && j > open) {
      spans.push([open, j]);
      open = null;
    }
  });
  if (open !== null) spans.push([open, messages.length - 1]);
  return spans;
}

type ParticipantData = { label: string; role: string };
function ParticipantNode({ data }: NodeProps & { data: ParticipantData }) {
  return (
    <div
      className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground shadow-sm"
      style={{ width: PART_W, height: PART_H }}
      title={`${data.label} · ${data.role}`}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ background: roleColor(data.role) }} />
      <span className="truncate">{data.label}</span>
    </div>
  );
}

type LifelineData = { role: string; height: number; activations: { top: number; height: number }[] };
function LifelineNode({ data }: NodeProps & { data: LifelineData }) {
  return (
    <div className="relative" style={{ width: LIFE_W, height: data.height }}>
      <div className="absolute left-1/2 top-0 h-full -translate-x-1/2 border-l border-dashed border-border" />
      {data.activations.map((a, i) => (
        <div
          key={i}
          className="absolute left-1/2 -translate-x-1/2 rounded-[3px]"
          style={{ top: a.top, height: a.height, width: 8, background: roleColor(data.role), opacity: 0.55 }}
        />
      ))}
    </div>
  );
}

type MessageData = { label: string; dir: "left" | "right"; width: number; id: string };
function MessageNode({ data }: NodeProps & { data: MessageData }) {
  const c = MSG_H / 2;
  const mid = `arr-${data.id}`;
  return (
    <div className="relative flex items-center justify-center" style={{ width: data.width, height: MSG_H }}>
      <svg className="absolute inset-0 text-muted-foreground/70" width={data.width} height={MSG_H} aria-hidden>
        <defs>
          <marker id={mid} markerWidth="9" markerHeight="9" refX="5" refY="3" orient="auto-start-reverse">
            <path d="M0,0 L6,3 L0,6 z" fill="currentColor" />
          </marker>
        </defs>
        <line
          x1={3}
          y1={c}
          x2={data.width - 3}
          y2={c}
          stroke="currentColor"
          strokeWidth={1.5}
          markerEnd={data.dir === "right" ? `url(#${mid})` : undefined}
          markerStart={data.dir === "left" ? `url(#${mid})` : undefined}
        />
      </svg>
      <div className="relative max-w-[210px] rounded-md border border-border bg-card px-2 py-1 text-center text-[11px] leading-snug text-card-foreground shadow-sm">
        {data.label}
      </div>
    </div>
  );
}

type SelfData = { label: string };
function SelfMessageNode({ data }: NodeProps & { data: SelfData }) {
  return (
    <div className="flex items-center gap-1.5" style={{ height: MSG_H }}>
      <svg width="26" height={MSG_H} className="shrink-0 text-muted-foreground/70" aria-hidden>
        <defs>
          <marker id="self-arr" markerWidth="9" markerHeight="9" refX="5" refY="3" orient="auto-start-reverse">
            <path d="M0,0 L6,3 L0,6 z" fill="currentColor" />
          </marker>
        </defs>
        <path
          d={`M2,${MSG_H / 2 - 8} h14 a6,6 0 0 1 0,12 h-14`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          markerEnd="url(#self-arr)"
        />
      </svg>
      <div className="max-w-[200px] rounded-md border border-border bg-card px-2 py-1 text-[11px] leading-snug text-card-foreground shadow-sm">
        {data.label}
      </div>
    </div>
  );
}

const nodeTypes = {
  participant: ParticipantNode,
  lifeline: LifelineNode,
  message: MessageNode,
  self: SelfMessageNode,
};

function build(diagram: SequenceModel): { nodes: Node[]; height: number } {
  const { participants, messages } = diagram;
  const idx = new Map(participants.map((p, i) => [p.id, i]));
  const height = FIRST_MSG + Math.max(0, messages.length - 1) * ROW + 60;
  const lifeHeight = height - LIFE_TOP - 12;
  const nodes: Node[] = [];

  participants.forEach((p, i) => {
    nodes.push({
      id: `h-${p.id}`,
      type: "participant",
      position: { x: cx(i) - PART_W / 2, y: HEAD_Y },
      data: { label: p.label, role: p.role },
      draggable: false,
      selectable: false,
      zIndex: 10,
    });
    const spans = activationSpans(messages, p.id).map(([a, b]) => ({
      top: rowCenter(a) - LIFE_TOP - 10,
      height: Math.max(20, rowCenter(b) - rowCenter(a) + 20),
    }));
    nodes.push({
      id: `l-${p.id}`,
      type: "lifeline",
      position: { x: cx(i) - LIFE_W / 2, y: LIFE_TOP },
      data: { role: p.role, height: lifeHeight, activations: spans },
      draggable: false,
      selectable: false,
      zIndex: 0,
    });
  });

  messages.forEach((m, j) => {
    const fromI = idx.get(m.from) ?? 0;
    const y = rowCenter(j) - MSG_H / 2;
    if (m.self) {
      nodes.push({
        id: `msg-${m.id}`,
        type: "self",
        position: { x: cx(fromI) + LIFE_W / 2, y },
        data: { label: m.label },
        draggable: false,
        selectable: false,
        zIndex: 5,
      });
      return;
    }
    const toI = idx.get(m.to) ?? 0;
    const leftX = Math.min(cx(fromI), cx(toI));
    const width = Math.max(40, Math.abs(cx(toI) - cx(fromI)));
    nodes.push({
      id: `msg-${m.id}`,
      type: "message",
      position: { x: leftX, y },
      style: { width },
      data: { label: m.label, dir: cx(fromI) < cx(toI) ? "right" : "left", width, id: m.id },
      draggable: false,
      selectable: false,
      zIndex: 5,
    });
  });

  return { nodes, height };
}

function Canvas({ diagram }: { diagram: SequenceModel }) {
  const { resolvedTheme } = useTheme();
  const { nodes } = useMemo(() => build(diagram), [diagram]);
  const rolesPresent = useMemo(() => [...new Set(diagram.participants.map((p) => p.role))].sort(), [diagram]);
  return (
    <ReactFlow
      nodes={nodes}
      edges={[]}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.05}
      maxZoom={3}
      proOptions={{ hideAttribution: true }}
      aria-label={`Sequence diagram — ${diagram.participants.length} participants, ${diagram.messages.length} messages. Toggle "list" for a text view.`}
      colorMode={resolvedTheme === "light" ? "light" : "dark"}
      panOnScroll
      zoomOnScroll={false}
      zoomOnPinch
      panOnDrag
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
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

/** Accessible text equivalent: the ordered messages as a numbered list. */
function MessageList({ diagram }: { diagram: SequenceModel }) {
  const nameById = new Map(diagram.participants.map((p) => [p.id, p.label]));
  return (
    <ol className="h-full space-y-1.5 overflow-auto p-4 text-sm">
      {diagram.messages.map((m, i) => (
        <li key={m.id} className="flex items-baseline gap-2">
          <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
          <span className="font-medium">{nameById.get(m.from) ?? m.from}</span>
          <span className="text-foreground/50">{m.self ? "↺" : "→"}</span>
          {!m.self ? <span className="font-medium">{nameById.get(m.to) ?? m.to}</span> : null}
          <span className="text-muted-foreground">{m.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function SequenceDiagram({ diagram }: { diagram: SequenceModel }) {
  const [view, setView] = useState<"graph" | "list">("graph");
  const { ref: fsRef, toggle: toggleFs } = useFullscreen<HTMLDivElement>();
  return (
    <div ref={fsRef} className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-border/60 bg-canvas">
      <div className="flex shrink-0 items-center justify-end gap-1.5 border-b border-border/60 px-2 py-1.5">
        <SegmentedControl options={["graph", "list"] as const} value={view} onChange={setView} />
        <button
          type="button"
          onClick={toggleFs}
          title="Fullscreen"
          aria-label="Toggle fullscreen"
          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Maximize2 className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {view === "graph" ? (
          <ReactFlowProvider>
            <Canvas diagram={diagram} />
          </ReactFlowProvider>
        ) : (
          <MessageList diagram={diagram} />
        )}
      </div>
    </div>
  );
}
