"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { GraphNode, GraphEdge, CompDetail } from "@/lib/diagrams";
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
  componentGraph: { nodes: GraphNode[]; edges: GraphEdge[] };
  componentDetails: Record<string, CompDetail>;
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
export interface DataModel {
  mermaid: string;
  entities: { name: string; fields: number; relations: number }[];
}
export interface Endpoint {
  id: string;
  method: string;
  path: string;
  protocol: string;
}
export interface Overview {
  trust: { total: number; refs: number; meanPct: number; high: number; medium: number; low: number };
  externals: string[];
  technologies: { name: string; category: string }[];
  analyzedAt: string | null;
}

const BAND_CLASS: Record<string, string> = {
  high: "border-success/30 text-success",
  medium: "border-warning/30 text-warning",
  low: "border-danger/30 text-danger",
};
const METHOD_CLASS: Record<string, string> = {
  GET: "text-success",
  QUERY: "text-success",
  POST: "text-warning",
  MUTATION: "text-warning",
  PUT: "text-primary",
  PATCH: "text-primary",
  DELETE: "text-danger",
};

function ChangeGroup({ title, added, removed }: { title: string; added: string[]; removed: string[] }) {
  if (!added.length && !removed.length) return null;
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium">{title}</div>
      <ul className="space-y-1 text-sm">
        {added.map((x) => (
          <li key={`a-${x}`} className="text-success">
            + {x}
          </li>
        ))}
        {removed.map((x) => (
          <li key={`r-${x}`} className="text-danger">
            − {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums tracking-tight">{n}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

export function ProjectTabs({
  project,
  overview,
  groups,
  components,
  diagrams,
  changes,
  data,
  endpoints,
}: {
  project: string;
  overview: Overview;
  groups: Group[];
  components: Comp[];
  diagrams: Diagrams;
  changes: Changes;
  data: DataModel | null;
  endpoints: Endpoint[];
}) {
  const [facet, setFacet] = useState("overview");
  const [apiQuery, setApiQuery] = useState("");

  const capCount = groups.reduce((n, g) => n + g.caps.length, 0);
  const facets: { id: string; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "diagrams", label: "Diagrams" },
    { id: "capabilities", label: "Capabilities", count: capCount },
    { id: "components", label: "Components", count: components.length },
    ...(data ? [{ id: "data", label: "Data", count: data.entities.length }] : []),
    ...(endpoints.length ? [{ id: "api", label: "API", count: endpoints.length }] : []),
    { id: "changes", label: "Changes", count: changes.total || undefined },
  ];

  const filteredEndpoints = useMemo(() => {
    const q = apiQuery.trim().toLowerCase();
    if (!q) return endpoints;
    return endpoints.filter((e) => `${e.method} ${e.path} ${e.protocol}`.toLowerCase().includes(q));
  }, [endpoints, apiQuery]);

  return (
    <div className="mt-6 flex flex-col gap-6 md:flex-row">
      <nav className="flex shrink-0 gap-1 overflow-x-auto md:w-44 md:flex-col md:overflow-visible" aria-label="Project facets">
        {facets.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFacet(f.id)}
            aria-current={facet === f.id ? "page" : undefined}
            className={cn(
              "relative flex items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors",
              facet === f.id
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <span>{f.label}</span>
            {f.count != null ? <span className="text-xs text-muted-foreground">{f.count}</span> : null}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
        {facet === "overview" ? (
          <div className="space-y-4">
            <Card className="flex flex-wrap items-center gap-x-10 gap-y-4 p-5">
              <Stat n={overview.trust.total} label="grounded elements" />
              <Stat n={overview.trust.refs} label="code references" />
              <Stat n={`${overview.trust.meanPct}%`} label="mean confidence" />
              <div className="ml-auto flex gap-2">
                <Badge variant="outline" className={BAND_CLASS.high}>
                  {overview.trust.high} high
                </Badge>
                <Badge variant="outline" className={BAND_CLASS.medium}>
                  {overview.trust.medium} medium
                </Badge>
                <Badge variant="outline" className={BAND_CLASS.low}>
                  {overview.trust.low} low
                </Badge>
              </div>
            </Card>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="flex flex-wrap content-start gap-2 p-5">
                <span className="w-full text-xs font-medium text-muted-foreground">External systems</span>
                {overview.externals.length ? (
                  overview.externals.map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">none</span>
                )}
              </Card>
              <Card className="flex flex-wrap content-start gap-2 p-5">
                <span className="w-full text-xs font-medium text-muted-foreground">Tech stack</span>
                {overview.technologies.length ? (
                  overview.technologies.map((tech) => (
                    <Badge key={tech.name} variant="outline" title={tech.category}>
                      {tech.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">none detected</span>
                )}
              </Card>
            </div>
            {overview.analyzedAt ? (
              <p className="text-xs text-muted-foreground">Analyzed {new Date(overview.analyzedAt).toLocaleString()}</p>
            ) : null}
          </div>
        ) : null}

        {facet === "diagrams" ? (
          <DiagramTabs
            project={project}
            context={diagrams.context}
            componentGraph={diagrams.componentGraph}
            componentDetails={diagrams.componentDetails}
            sequence={diagrams.sequence}
            processXml={diagrams.processXml}
            edited={diagrams.edited}
            onNavigate={setFacet}
          />
        ) : null}

        {facet === "capabilities" ? (
          groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No capabilities.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

        {facet === "components" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {components.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="font-semibold">{c.label}</div>
                <div className="mt-1 text-sm text-muted-foreground">{c.responsibility}</div>
              </Card>
            ))}
          </div>
        ) : null}

        {facet === "data" && data ? (
          <div className="space-y-4">
            <div className="h-[60vh]">
              <Mermaid id="erd" chart={data.mermaid} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

        {facet === "api" && endpoints.length ? (
          <div className="space-y-3">
            <Input
              value={apiQuery}
              onChange={(e) => setApiQuery(e.target.value)}
              placeholder="Filter by method, path, or protocol…"
              className="max-w-sm"
            />
            <Card className="p-0">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border/60 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Method</th>
                    <th className="px-4 py-2.5 font-medium">Path / operation</th>
                    <th className="px-4 py-2.5 font-medium">Protocol</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEndpoints.map((e) => (
                    <tr key={e.id} className="border-b border-border/40 last:border-0 hover:bg-muted/40">
                      <td className={`px-4 py-2 font-mono font-semibold ${METHOD_CLASS[e.method] ?? ""}`}>{e.method}</td>
                      <td className="px-4 py-2 font-mono">{e.path}</td>
                      <td className="px-4 py-2 text-muted-foreground">{e.protocol}</td>
                    </tr>
                  ))}
                  {filteredEndpoints.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                        No endpoints match “{apiQuery}”.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </Card>
          </div>
        ) : null}

        {facet === "changes" ? (
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
    </div>
  );
}
