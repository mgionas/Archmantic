"use client";

import dynamic from "next/dynamic";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  sequence,
  processXml,
  edited,
  onNavigate,
}: {
  project: string;
  contextGraph: { nodes: ContextNode[]; edges: ContextEdge[] };
  contextDetails: Record<string, ContextDetail>;
  componentGraph: { nodes: GraphNode[]; edges: GraphEdge[] };
  componentDetails: Record<string, CompDetail>;
  sequence: string | null;
  processXml: string | null;
  edited: boolean;
  onNavigate?: (facet: string) => void;
}) {
  const [tab, setTab] = useUrlState("d", "context");

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList variant="line">
        <TabsTrigger value="context">Context</TabsTrigger>
        <TabsTrigger value="components">Components</TabsTrigger>
        {sequence ? <TabsTrigger value="sequence">Sequence</TabsTrigger> : null}
        {processXml ? (
          <TabsTrigger value="process">
            Process {edited ? <Badge variant="secondary" className="ml-1.5">edited</Badge> : null}
          </TabsTrigger>
        ) : null}
      </TabsList>

      {/* One tall, interactive canvas; render only the active diagram so it mounts at full size. */}
      <div className="h-[72vh] pt-3">
        {tab === "context" ? (
          <ContextGraph graph={contextGraph} details={contextDetails} onNavigate={onNavigate} />
        ) : null}
        {tab === "components" ? (
          <ComponentGraph graph={componentGraph} details={componentDetails} onNavigate={onNavigate} />
        ) : null}
        {tab === "sequence" && sequence ? <Mermaid id="seq" chart={sequence} /> : null}
        {tab === "process" && processXml ? <BpmnEditor project={project} initialXml={processXml} /> : null}
      </div>
    </Tabs>
  );
}
