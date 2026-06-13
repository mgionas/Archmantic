"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DiagramTabs } from "./diagram-tabs";
import { Mermaid } from "./diagrams-client";
import { band } from "@/lib/format";

export interface Cap {
  id: string;
  name: string;
  refs: number;
  confidence: number;
}
export interface Group {
  area: string;
  caps: Cap[];
}
export interface Comp {
  id: string;
  label: string;
  responsibility: string;
}
export interface Diagrams {
  context: string;
  components: string;
  sequence: string | null;
  processXml: string | null;
  edited: boolean;
}
export interface Changes {
  hasPrev: boolean;
  total: number;
  components: { added: string[]; removed: string[] };
  capabilities: { added: string[]; removed: string[] };
  externals: { added: string[]; removed: string[] };
}

function ChangeGroup({ title, added, removed }: { title: string; added: string[]; removed: string[] }) {
  if (!added.length && !removed.length) return null;
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium">{title}</div>
      <ul className="space-y-1 text-sm">
        {added.map((x) => (
          <li key={`a-${x}`} className="text-green-400">
            + {x}
          </li>
        ))}
        {removed.map((x) => (
          <li key={`r-${x}`} className="text-red-400">
            − {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

const BAND_CLASS: Record<string, string> = {
  high: "border-green-500/30 text-green-400",
  medium: "border-amber-500/30 text-amber-400",
  low: "border-red-500/30 text-red-400",
};

export interface DataModel {
  mermaid: string;
  entities: { name: string; fields: number; relations: number }[];
}

export function ProjectTabs({
  project,
  groups,
  components,
  diagrams,
  changes,
  data,
}: {
  project: string;
  groups: Group[];
  components: Comp[];
  diagrams: Diagrams;
  changes: Changes;
  data: DataModel | null;
}) {
  const [tab, setTab] = useState("diagrams");

  return (
    <Tabs value={tab} onValueChange={setTab} className="mt-6">
      <TabsList>
        <TabsTrigger value="diagrams">Diagrams</TabsTrigger>
        <TabsTrigger value="capabilities">Capabilities ({groups.reduce((n, g) => n + g.caps.length, 0)})</TabsTrigger>
        <TabsTrigger value="components">Components ({components.length})</TabsTrigger>
        {data ? <TabsTrigger value="data">Data ({data.entities.length})</TabsTrigger> : null}
        <TabsTrigger value="changes">Changes{changes.total > 0 ? ` (${changes.total})` : ""}</TabsTrigger>
      </TabsList>

      <div className="pt-5">
        {tab === "diagrams" ? (
          <Card className="p-4">
            <DiagramTabs
              project={project}
              context={diagrams.context}
              components={diagrams.components}
              sequence={diagrams.sequence}
              processXml={diagrams.processXml}
              edited={diagrams.edited}
            />
          </Card>
        ) : null}

        {tab === "capabilities" ? (
          groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No capabilities.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((g) => (
                <Card key={g.area} className="p-4">
                  <div className="mb-2 font-mono text-xs text-muted-foreground">{g.area}/</div>
                  <ul className="space-y-1.5">
                    {g.caps.map((c) => (
                      <li key={c.id} className="flex items-baseline justify-between gap-2">
                        <span className="text-sm">{c.name}</span>
                        <Badge variant="outline" className={`shrink-0 ${BAND_CLASS[band(c.confidence)]}`}>
                          {c.refs} ref{c.refs === 1 ? "" : "s"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )
        ) : null}

        {tab === "components" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {components.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="font-semibold">{c.label}</div>
                <div className="mt-1 text-sm text-muted-foreground">{c.responsibility}</div>
              </Card>
            ))}
          </div>
        ) : null}

        {tab === "data" && data ? (
          <div className="space-y-4">
            <Card className="overflow-auto p-4">
              <Mermaid id="erd" chart={data.mermaid} />
            </Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.entities.map((e) => (
                <Card key={e.name} className="p-4">
                  <div className="font-semibold">{e.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {e.fields} field{e.fields === 1 ? "" : "s"}
                    {e.relations ? ` · ${e.relations} relation${e.relations === 1 ? "" : "s"}` : ""}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "changes" ? (
          !changes.hasPrev ? (
            <p className="text-sm text-muted-foreground">First snapshot — nothing to compare against yet.</p>
          ) : changes.total === 0 ? (
            <p className="text-sm text-muted-foreground">No architecture changes since the previous snapshot.</p>
          ) : (
            <Card className="space-y-5 p-5">
              <div className="text-sm text-muted-foreground">Architecture changes vs the previous snapshot:</div>
              <ChangeGroup title="Components" added={changes.components.added} removed={changes.components.removed} />
              <ChangeGroup title="Capabilities" added={changes.capabilities.added} removed={changes.capabilities.removed} />
              <ChangeGroup title="External systems" added={changes.externals.added} removed={changes.externals.removed} />
            </Card>
          )
        ) : null}
      </div>
    </Tabs>
  );
}
