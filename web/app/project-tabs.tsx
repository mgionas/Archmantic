"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { cn } from "@/lib/utils";
import { useUrlState } from "@/lib/use-url-state";
import type {
  GraphNode,
  GraphEdge,
  FlowEdge,
  CompDetail,
  ContextNode,
  ContextEdge,
  ContextDetail,
  EntityNode,
  EntityEdge,
} from "@/lib/diagrams";
import { DiagramTabs } from "./diagram-tabs";
import { KnowledgeView } from "@/components/knowledge-view";
import { FeatureEditor } from "@/components/feature-editor";
import { band, roleColor } from "@/lib/format";

const EntityGraph = dynamic(() => import("@/components/entity-graph").then((m) => m.EntityGraph), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading graph…</div>,
});

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
  role: string;
  path: string;
  responsibility: string;
  package?: string;
}
export interface Diagrams {
  contextGraph: { nodes: ContextNode[]; edges: ContextEdge[] };
  contextDetails: Record<string, ContextDetail>;
  componentGraph: { nodes: GraphNode[]; edges: GraphEdge[] };
  componentDetails: Record<string, CompDetail>;
  sequences: { id: string; name: string; graph: { nodes: GraphNode[]; edges: FlowEdge[] } }[];
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
  graph: { nodes: EntityNode[]; edges: EntityEdge[] };
  entities: { name: string; fields: number; relations: number }[];
}
export interface Endpoint {
  id: string;
  method: string;
  path: string;
  protocol: string;
  package?: string;
}
export interface FeatureView {
  id: string;
  name: string;
  description: string;
  status: string | null;
  shows: { text: string; source?: string }[];
  actions: { name: string; description?: string }[];
  dependsOn: string[];
  components: string[];
  componentPaths: string[];
  flow: { from: string; action: string; to: string }[];
  human: boolean;
}
export interface ProjectManifest {
  goal?: string;
  status?: string;
  author?: { name: string; email?: string; url?: string };
  owners?: string[];
  links?: { label: string; url: string }[];
  agents?: { name: string; role?: string; file?: string }[];
  history?: { date?: string; note: string }[];
}
export interface Overview {
  trust: { total: number; refs: number; meanPct: number; high: number; medium: number; low: number };
  externals: string[];
  technologies: { name: string; category: string }[];
  analyzedAt: string | null;
  manifest?: ProjectManifest | null;
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

const folderOfPath = (p: string) => {
  const i = p.lastIndexOf("/");
  return i === -1 ? "." : p.slice(0, i);
};

/** Group key for an endpoint: REST → its resource segment, else the protocol. */
function resourceOf(e: Endpoint): string {
  if (e.protocol === "trpc") return "tRPC";
  if (e.protocol === "graphql") return "GraphQL";
  const segs = e.path.split("/").filter(Boolean).filter((s) => s !== "api" && !/^v\d+$/.test(s));
  const first = segs.find((s) => !s.startsWith(":") && s !== "*") ?? segs[0] ?? "";
  return first ? `/${first}` : "/";
}

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
  features = [],
  knowledge,
  workspaces = [],
}: {
  project: string;
  overview: Overview;
  groups: Group[];
  components: Comp[];
  diagrams: Diagrams;
  changes: Changes;
  data: DataModel | null;
  endpoints: Endpoint[];
  features?: FeatureView[];
  knowledge: string;
  workspaces?: string[];
}) {
  const isMono = workspaces.length > 0;
  const [facetParam, setFacet] = useUrlState("view", "overview");
  const [apiQuery, setApiQuery] = useState("");
  const [compQuery, setCompQuery] = useState("");
  const [compGroupBy, setCompGroupBy] = useState<"role" | "folder" | "package">(isMono ? "package" : "role");
  const [apiGroupBy, setApiGroupBy] = useState<"resource" | "package">(isMono ? "package" : "resource");

  const capCount = groups.reduce((n, g) => n + g.caps.length, 0);
  const facets: { id: string; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "diagrams", label: "Diagrams" },
    ...(features.length ? [{ id: "features", label: "Features", count: features.length }] : []),
    { id: "capabilities", label: "Capabilities", count: capCount },
    { id: "components", label: "Components", count: components.length },
    ...(data ? [{ id: "data", label: "Data", count: data.entities.length }] : []),
    ...(endpoints.length ? [{ id: "api", label: "API", count: endpoints.length }] : []),
    { id: "changes", label: "Changes", count: changes.total || undefined },
    { id: "knowledge", label: "Knowledge" },
  ];
  const facet = facets.some((f) => f.id === facetParam) ? facetParam : "overview";

  const compGroups = useMemo(() => {
    const q = compQuery.trim().toLowerCase();
    const filtered = components.filter(
      (c) => !q || `${c.label} ${c.path} ${c.responsibility} ${c.role}`.toLowerCase().includes(q),
    );
    const m = new Map<string, Comp[]>();
    for (const c of filtered) {
      const key =
        compGroupBy === "role" ? c.role : compGroupBy === "package" ? c.package ?? "(root)" : folderOfPath(c.path);
      (m.get(key) ?? m.set(key, []).get(key)!).push(c);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [components, compQuery, compGroupBy]);

  const apiGroups = useMemo(() => {
    const q = apiQuery.trim().toLowerCase();
    const filtered = endpoints.filter((e) => !q || `${e.method} ${e.path} ${e.protocol}`.toLowerCase().includes(q));
    const m = new Map<string, Endpoint[]>();
    for (const e of filtered) {
      const key = apiGroupBy === "package" ? e.package ?? "(root)" : resourceOf(e);
      (m.get(key) ?? m.set(key, []).get(key)!).push(e);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [endpoints, apiQuery, apiGroupBy]);

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
            {overview.manifest && (overview.manifest.goal || overview.manifest.author?.name || overview.manifest.agents?.length) ? (
              <Card className="space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Project brain</span>
                  {overview.manifest.status ? (
                    <Badge variant="outline" className="font-normal capitalize">
                      {overview.manifest.status}
                    </Badge>
                  ) : null}
                  {overview.manifest.author?.name ? (
                    <span className="ml-auto text-xs text-muted-foreground">
                      by{" "}
                      {overview.manifest.author.url ? (
                        <a href={overview.manifest.author.url} className="text-primary hover:underline">
                          {overview.manifest.author.name}
                        </a>
                      ) : (
                        overview.manifest.author.name
                      )}
                    </span>
                  ) : null}
                </div>
                {overview.manifest.goal ? <p className="text-sm leading-relaxed">{overview.manifest.goal}</p> : null}
                {overview.manifest.agents?.length ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Agents:</span>
                    {overview.manifest.agents.map((a) => (
                      <Badge key={a.name} variant="secondary" title={a.role} className="font-normal">
                        {a.name}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {overview.manifest.links?.length ? (
                  <div className="flex flex-wrap gap-3 text-sm">
                    {overview.manifest.links.map((l) => (
                      <a key={l.url} href={l.url} className="text-primary hover:underline">
                        {l.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </Card>
            ) : null}
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
            {isMono ? (
              <Card className="flex flex-wrap content-start items-center gap-2 p-5">
                <span className="w-full text-xs font-medium text-muted-foreground">
                  Monorepo · {workspaces.length} package{workspaces.length === 1 ? "" : "s"}
                </span>
                {workspaces.map((w) => (
                  <Badge key={w} variant="secondary" className="font-mono">
                    {w}
                  </Badge>
                ))}
              </Card>
            ) : null}
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
            contextGraph={diagrams.contextGraph}
            contextDetails={diagrams.contextDetails}
            componentGraph={diagrams.componentGraph}
            componentDetails={diagrams.componentDetails}
            sequences={diagrams.sequences}
            processXml={diagrams.processXml}
            edited={diagrams.edited}
            onNavigate={setFacet}
          />
        ) : null}

        {facet === "features" ? (
          features.length === 0 ? (
            <p className="text-sm text-muted-foreground">No features yet.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                What the product does, from the user&apos;s perspective. Draft features are seeded from pages/routes —
                refine them in <code className="rounded bg-muted px-1 py-0.5 text-xs">.archmantic/features/*.md</code>, with{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">archmantic edit</code> (local editor), or{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">archmantic feature sync</code> (AI).
              </p>
              <div className="grid gap-3 lg:grid-cols-2">
                {features.map((f) => (
                  <FeatureEditor key={f.id} project={project} feature={f} />
                ))}
              </div>
            </div>
          )
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
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                value={compQuery}
                onChange={(e) => setCompQuery(e.target.value)}
                placeholder="Filter components…"
                className="max-w-sm"
              />
              <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-border/60 p-0.5">
                {((isMono ? ["package", "role", "folder"] : ["role", "folder"]) as Array<typeof compGroupBy>).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setCompGroupBy(g)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs capitalize transition-colors",
                      compGroupBy === g ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            {compGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No components match “{compQuery}”.</p>
            ) : (
              compGroups.map(([key, items]) => (
                <CollapsibleSection
                  key={key}
                  storageKey={`arch:cg:${project}:${compGroupBy}:${key}`}
                  header={compGroupBy === "folder" ? `${key}/` : key}
                  accent={compGroupBy === "role" ? roleColor(key) : undefined}
                  count={items.length}
                >
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((c) => (
                      <Card key={c.id} className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="size-2 shrink-0 rounded-full" style={{ background: roleColor(c.role) }} />
                          <span className="truncate font-medium" title={c.path}>
                            {c.label}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground" title={c.responsibility}>
                          {c.responsibility}
                        </div>
                      </Card>
                    ))}
                  </div>
                </CollapsibleSection>
              ))
            )}
          </div>
        ) : null}

        {facet === "data" && data ? (
          <div className="space-y-4">
            <div className="h-[60vh]">
              <EntityGraph graph={data.graph} />
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
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                value={apiQuery}
                onChange={(e) => setApiQuery(e.target.value)}
                placeholder="Filter by method, path, or protocol…"
                className="max-w-sm"
              />
              {isMono ? (
                <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-border/60 p-0.5">
                  {(["package", "resource"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setApiGroupBy(g)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs capitalize transition-colors",
                        apiGroupBy === g ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {apiGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No endpoints match “{apiQuery}”.</p>
            ) : (
              <div className="space-y-3">
                {apiGroups.map(([resource, eps]) => (
                  <CollapsibleSection
                    key={resource}
                    storageKey={`arch:api:${project}:${apiGroupBy}:${resource}`}
                    header={<span className="font-mono">{resource}</span>}
                    count={eps.length}
                  >
                    <Card className="overflow-hidden p-0">
                      <ul>
                        {eps.map((e) => (
                          <li
                            key={e.id}
                            className="flex items-baseline gap-3 border-b border-border/30 px-3 py-1.5 last:border-0 hover:bg-muted/40"
                          >
                            <span className={`w-16 shrink-0 font-mono text-xs font-semibold ${METHOD_CLASS[e.method] ?? ""}`}>
                              {e.method}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-mono text-xs">{e.path}</span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">{e.protocol}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </CollapsibleSection>
                ))}
              </div>
            )}
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

        {facet === "knowledge" ? <KnowledgeView text={knowledge} /> : null}
      </div>
    </div>
  );
}
