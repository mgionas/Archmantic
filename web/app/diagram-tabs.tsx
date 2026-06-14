"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useUrlState } from "@/lib/use-url-state";
import { DiagramPicker } from "@/components/diagram-picker";
import { BpmnEditor } from "./diagrams-client";
import type { GraphNode, GraphEdge, FlowEdge, CompDetail, ContextNode, ContextEdge, ContextDetail, EntityNode, EntityEdge } from "@/lib/diagrams";

// React Flow + dagre (~70kB) only load when an interactive graph view is opened.
const loading = () => <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading graph…</div>;
const ComponentGraph = dynamic(() => import("@/components/component-graph").then((m) => m.ComponentGraph), { ssr: false, loading });
const ContextGraph = dynamic(() => import("@/components/context-graph").then((m) => m.ContextGraph), { ssr: false, loading });
const SequenceGraph = dynamic(() => import("@/components/sequence-graph").then((m) => m.SequenceGraph), { ssr: false, loading });
const EntityGraph = dynamic(() => import("@/components/entity-graph").then((m) => m.EntityGraph), { ssr: false, loading });

/**
 * Deck picker: a wrapped row of chips for small decks (≤6), a searchable selector
 * for large ones (70+ features would be an unscannable wall of buttons).
 */
function DeckPicker({ items, active, onPick, label }: { items: { id: string; name: string }[]; active: string; onPick: (id: string) => void; label: string }) {
  if (items.length < 2) return null;
  if (items.length > 6) return <DiagramPicker items={items} active={active} onPick={onPick} label={label} />;
  return (
    <div className="mt-3 flex max-w-full flex-wrap gap-1.5">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onPick(it.id)}
          className={cn(
            "rounded-md border px-2.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            active === it.id
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border/60 text-muted-foreground hover:text-foreground",
          )}
        >
          {it.name}
        </button>
      ))}
    </div>
  );
}

export function DiagramTabs({
  project,
  contextGraph,
  contextDetails,
  componentGraph,
  componentDetails,
  sequences,
  processXml,
  erd,
  edited,
  focusNode,
  onNavigate,
}: {
  project: string;
  contextGraph: { nodes: ContextNode[]; edges: ContextEdge[] };
  contextDetails: Record<string, ContextDetail>;
  componentGraph: { nodes: GraphNode[]; edges: GraphEdge[] };
  componentDetails: Record<string, CompDetail>;
  sequences: { id: string; name: string; graph: { nodes: GraphNode[]; edges: FlowEdge[] } }[];
  processXml: string | null;
  erd: { nodes: EntityNode[]; edges: EntityEdge[] } | null;
  edited: boolean;
  focusNode?: string | null;
  onNavigate?: (facet: string) => void;
}) {
  const [tab, setTab] = useUrlState("d", "context");
  // When a list item asks to "open in graph", jump to the Components tab.
  useEffect(() => {
    if (focusNode) setTab("components");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNode]);
  const [seqId, setSeqId] = useUrlState("seq", sequences[0]?.id ?? "");
  const activeSeq = sequences.find((s) => s.id === seqId) ?? sequences[0];
  const hasSeq = sequences.length > 0;

  // Process deck: the editable "Main" BPMN (edit-then-build) + one process per feature.
  const procItems = [
    ...(processXml ? [{ id: "__main", name: edited ? "Main · edited" : "Main process" }] : []),
    ...sequences.map((s) => ({ id: s.id, name: s.name })),
  ];
  const [procId, setProcId] = useUrlState("proc", processXml ? "__main" : sequences[0]?.id ?? "");
  const activeProcId = procItems.find((p) => p.id === procId)?.id ?? procItems[0]?.id ?? "";
  const procFlow = sequences.find((s) => s.id === activeProcId);
  const hasProcess = procItems.length > 0;

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList variant="line">
        <TabsTrigger value="context">Context</TabsTrigger>
        <TabsTrigger value="components">Components</TabsTrigger>
        {hasSeq ? (
          <TabsTrigger value="sequence">
            Sequence {sequences.length > 1 ? <Badge variant="secondary" className="ml-1.5">{sequences.length}</Badge> : null}
          </TabsTrigger>
        ) : null}
        {hasProcess ? (
          <TabsTrigger value="process">
            Process {procItems.length > 1 ? <Badge variant="secondary" className="ml-1.5">{procItems.length}</Badge> : null}
          </TabsTrigger>
        ) : null}
        {erd ? <TabsTrigger value="erd">ERD</TabsTrigger> : null}
      </TabsList>

      {/* Per-feature decks: pick a feature to swap the canvas. */}
      {tab === "sequence" ? <DeckPicker items={sequences} active={activeSeq?.id ?? ""} onPick={setSeqId} label="sequence" /> : null}
      {tab === "process" ? <DeckPicker items={procItems} active={activeProcId} onPick={setProcId} label="process" /> : null}

      {/* One tall, interactive canvas; render only the active diagram so it mounts at full size. */}
      <div className="h-[72vh] pt-3">
        {tab === "context" ? (
          <ContextGraph graph={contextGraph} details={contextDetails} onNavigate={onNavigate} />
        ) : null}
        {tab === "components" ? (
          <ComponentGraph graph={componentGraph} details={componentDetails} onNavigate={onNavigate} focusId={focusNode} />
        ) : null}
        {tab === "sequence" && activeSeq ? <SequenceGraph key={activeSeq.id} graph={activeSeq.graph} /> : null}
        {tab === "process" ? (
          activeProcId === "__main" && processXml ? (
            <BpmnEditor project={project} initialXml={processXml} />
          ) : procFlow ? (
            <SequenceGraph key={procFlow.id} graph={procFlow.graph} rankdir="LR" />
          ) : null
        ) : null}
        {tab === "erd" && erd ? <EntityGraph graph={erd} /> : null}
      </div>
    </Tabs>
  );
}
