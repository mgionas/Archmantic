"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useUrlState } from "@/lib/use-url-state";
import { BpmnEditor, Mermaid } from "./diagrams-client";
import type { GraphNode, GraphEdge, CompDetail, ContextNode, ContextEdge, ContextDetail } from "@/lib/diagrams";

// React Flow + dagre (~70kB) only load when an interactive graph view is opened.
const loading = () => <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading graph…</div>;
const ComponentGraph = dynamic(() => import("@/components/component-graph").then((m) => m.ComponentGraph), { ssr: false, loading });
const ContextGraph = dynamic(() => import("@/components/context-graph").then((m) => m.ContextGraph), { ssr: false, loading });

export function DiagramTabs({
  project,
  contextGraph,
  contextDetails,
  componentGraph,
  componentDetails,
  sequences,
  processXml,
  edited,
  onNavigate,
}: {
  project: string;
  contextGraph: { nodes: ContextNode[]; edges: ContextEdge[] };
  contextDetails: Record<string, ContextDetail>;
  componentGraph: { nodes: GraphNode[]; edges: GraphEdge[] };
  componentDetails: Record<string, CompDetail>;
  sequences: { id: string; name: string; chart: string }[];
  processXml: string | null;
  edited: boolean;
  onNavigate?: (facet: string) => void;
}) {
  const [tab, setTab] = useUrlState("d", "context");
  const [seqId, setSeqId] = useState(sequences[0]?.id ?? "");
  const activeSeq = sequences.find((s) => s.id === seqId) ?? sequences[0];
  const hasSeq = sequences.length > 0;

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
        {processXml ? (
          <TabsTrigger value="process">
            Process {edited ? <Badge variant="secondary" className="ml-1.5">edited</Badge> : null}
          </TabsTrigger>
        ) : null}
      </TabsList>

      {/* Sequence is a per-feature deck: pick a feature, see its flow. */}
      {tab === "sequence" && hasSeq && sequences.length > 1 ? (
        <div className="mt-3 flex max-w-full flex-wrap gap-1.5">
          {sequences.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSeqId(s.id)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                activeSeq?.id === s.id
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}

      {/* One tall, interactive canvas; render only the active diagram so it mounts at full size. */}
      <div className="h-[72vh] pt-3">
        {tab === "context" ? (
          <ContextGraph graph={contextGraph} details={contextDetails} onNavigate={onNavigate} />
        ) : null}
        {tab === "components" ? (
          <ComponentGraph graph={componentGraph} details={componentDetails} onNavigate={onNavigate} />
        ) : null}
        {tab === "sequence" && activeSeq ? <Mermaid key={activeSeq.id} id="seq" chart={activeSeq.chart} /> : null}
        {tab === "process" && processXml ? <BpmnEditor project={project} initialXml={processXml} /> : null}
      </div>
    </Tabs>
  );
}
