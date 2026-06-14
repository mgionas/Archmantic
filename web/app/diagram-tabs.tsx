"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BpmnEditor, Mermaid } from "./diagrams-client";
import type { GraphNode, GraphEdge, CompDetail } from "@/lib/diagrams";

// React Flow + dagre (~70kB) only load when the Components view is opened.
const ComponentGraph = dynamic(() => import("@/components/component-graph").then((m) => m.ComponentGraph), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading graph…</div>,
});

export function DiagramTabs({
  project,
  context,
  componentGraph,
  componentDetails,
  sequence,
  processXml,
  edited,
  onNavigate,
}: {
  project: string;
  context: string;
  componentGraph: { nodes: GraphNode[]; edges: GraphEdge[] };
  componentDetails: Record<string, CompDetail>;
  sequence: string | null;
  processXml: string | null;
  edited: boolean;
  onNavigate?: (facet: string) => void;
}) {
  const [tab, setTab] = useState("context");

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
        {tab === "context" ? <Mermaid id="ctx" chart={context} /> : null}
        {tab === "components" ? (
          <ComponentGraph graph={componentGraph} details={componentDetails} onNavigate={onNavigate} />
        ) : null}
        {tab === "sequence" && sequence ? <Mermaid id="seq" chart={sequence} /> : null}
        {tab === "process" && processXml ? <BpmnEditor project={project} initialXml={processXml} /> : null}
      </div>
    </Tabs>
  );
}
