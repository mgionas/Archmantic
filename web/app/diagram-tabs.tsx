"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BpmnEditor, Mermaid } from "./diagrams-client";

export function DiagramTabs({
  project,
  context,
  components,
  sequence,
  processXml,
  edited,
}: {
  project: string;
  context: string;
  components: string;
  sequence: string | null;
  processXml: string | null;
  edited: boolean;
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
        {tab === "components" ? <Mermaid id="comp" chart={components} /> : null}
        {tab === "sequence" && sequence ? <Mermaid id="seq" chart={sequence} /> : null}
        {tab === "process" && processXml ? <BpmnEditor project={project} initialXml={processXml} /> : null}
      </div>
    </Tabs>
  );
}
