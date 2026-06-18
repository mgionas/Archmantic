"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  SequenceModel,
} from "@/lib/diagrams";
import { DiagramTabs } from "./diagram-tabs";
import { KnowledgeView } from "@/components/knowledge-view";
import { FeatureEditor } from "@/components/feature-editor";
import { RoleLegend } from "@/components/ui/role-legend";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { band, roleColor, sourceHref } from "@/lib/format";
import { Provenance } from "@/components/ui/provenance";

export interface Cap {
  id: string;
  name: string;
  refs: number;
  confidence: number;
  ref?: string | null;
}
export interface SourceInfo {
  base: string | null;
  sha: string | null;
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
  sequences: { id: string; name: string; graph: { nodes: GraphNode[]; edges: FlowEdge[] }; diagram: SequenceModel }[];
  processXml: string | null;
  erd: { nodes: EntityNode[]; edges: EntityEdge[] } | null;
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
  entities: { name: string; fields: number; relations: number; ref?: string | null }[];
}
export interface Endpoint {
  id: string;
  method: string;
  path: string;
  protocol: string;
  package?: string;
  ref?: string | null;
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
  pending: boolean;
}
export interface SkillMatchView {
  id: string;
  name: string;
  description: string;
  source: string;
  agent?: string;
  tags: string[];
  /** grounded reasons this skill matched the model (the "why") */
  reasons: string[];
  triggers: string[];
  body: string;
}
export interface TechView {
  id: string;
  name: string;
  category: string;
  version: string | null;
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
const BAR_CLASS: Record<string, string> = { high: "bg-success", medium: "bg-warning", low: "bg-danger" };
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

const CAT_ORDER = ["language", "framework", "ui", "database", "orm", "auth", "ai", "infra", "build", "testing", "library"];
const CAT_LABEL: Record<string, string> = {
  language: "Languages",
  framework: "Frameworks",
  ui: "UI",
  database: "Databases",
  orm: "ORM / data",
  auth: "Auth",
  ai: "AI",
  infra: "Infrastructure",
  build: "Build",
  testing: "Testing",
  library: "Libraries",
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

function SkillCard({ project, skill }: { project: string; skill: SkillMatchView }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{skill.name}</span>
        <Badge variant="outline" className="font-normal capitalize text-muted-foreground">
          {skill.source}
        </Badge>
        {skill.agent ? (
          <Badge variant="secondary" className="font-normal" title="Suggested agent to run this skill">
            agent: {skill.agent}
          </Badge>
        ) : null}
      </div>
      {skill.description ? <p className="text-sm text-muted-foreground">{skill.description}</p> : null}
      {skill.reasons.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">why:</span>
          {skill.reasons.map((r) => (
            <Badge key={r} variant="outline" className="border-success/30 font-normal text-success">
              {r}
            </Badge>
          ))}
        </div>
      ) : null}
      {skill.tags.length ? (
        <div className="flex flex-wrap gap-1.5">
          {skill.tags.map((tag) => (
            <span key={tag} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <CollapsibleSection storageKey={`arch:skill:${project}:${skill.id}`} header="Playbook" defaultOpen={false}>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">{skill.body}</pre>
      </CollapsibleSection>
    </Card>
  );
}

function DependenciesView({ project, technologies }: { project: string; technologies: TechView[] }) {
  const byCat = new Map<string, TechView[]>();
  for (const t of technologies) (byCat.get(t.category) ?? byCat.set(t.category, []).get(t.category)!).push(t);
  const curated = CAT_ORDER.filter((c) => c !== "library" && byCat.has(c));
  const libs = (byCat.get("library") ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const sortByName = (a: TechView, b: TechView) => a.name.localeCompare(b.name);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Everything this project is built with — the curated stack plus every runtime library, with declared versions.
        Libraries are tracked here, off the architecture graphs, so the diagrams stay about real systems.
      </p>
      {curated.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {curated.map((cat) => (
            <Card key={cat} className="content-start space-y-2 p-4">
              <div className="text-xs font-medium text-muted-foreground">{CAT_LABEL[cat] ?? cat}</div>
              <ul className="space-y-1.5">
                {byCat.get(cat)!.slice().sort(sortByName).map((t) => (
                  <li key={t.id} className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm">{t.name}</span>
                    {t.version ? <span className="shrink-0 font-mono text-xs text-muted-foreground">{t.version}</span> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : null}
      {libs.length ? (
        <CollapsibleSection storageKey={`arch:deps:libs:${project}`} header="Libraries" count={libs.length} defaultOpen={false}>
          <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {libs.map((t) => (
              <div key={t.id} className="flex items-baseline justify-between gap-2">
                <span className="truncate font-mono text-xs">{t.name}</span>
                {t.version ? <span className="shrink-0 font-mono text-xs text-muted-foreground">{t.version}</span> : null}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      ) : null}
    </div>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="flex items-baseline gap-2">
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
  skills = [],
  technologies = [],
  knowledge,
  workspaces = [],
  source = { base: null, sha: null },
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
  skills?: SkillMatchView[];
  technologies?: TechView[];
  knowledge: string;
  workspaces?: string[];
  source?: SourceInfo;
}) {
  const isMono = workspaces.length > 0;
  const [facetParam, setFacet] = useUrlState("view", "overview");
  const [apiQuery, setApiQuery] = useState("");
  const [compQuery, setCompQuery] = useState("");
  const [compGroupBy, setCompGroupBy] = useState<"role" | "folder" | "package">(isMono ? "package" : "role");
  const [compView, setCompView] = useState<"grid" | "list">("grid");
  const [focusNode, setFocusNode] = useState<string | null>(null);
  const openInGraph = (id: string) => {
    setFocusNode(id);
    setFacet("diagrams");
  };
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
    ...(technologies.length ? [{ id: "deps", label: "Dependencies", count: technologies.length }] : []),
    ...(skills.length ? [{ id: "skills", label: "Skills", count: skills.length }] : []),
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
              <div className="ml-auto min-w-[200px] flex-1 sm:flex-none">
                <div className="flex h-2 overflow-hidden rounded-full bg-muted" title="confidence distribution">
                  {(["high", "medium", "low"] as const).map((b) => {
                    const n = overview.trust[b];
                    const pct = overview.trust.total ? (n / overview.trust.total) * 100 : 0;
                    return pct > 0 ? (
                      <div key={b} style={{ width: `${pct}%` }} className={BAR_CLASS[b]} title={`${n} ${b} confidence`} />
                    ) : null;
                  })}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span className="text-success">{overview.trust.high} high</span>
                  <span className="text-warning">{overview.trust.medium} medium</span>
                  <span className="text-danger">{overview.trust.low} low</span>
                </div>
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
              <Card className="content-start space-y-3 p-5">
                <div className="flex flex-wrap content-start gap-2">
                  <span className="w-full text-xs font-medium text-muted-foreground">Tech stack</span>
                  {overview.technologies.some((t) => t.category !== "library") ? (
                    overview.technologies
                      .filter((t) => t.category !== "library")
                      .map((tech) => (
                        <Badge key={tech.name} variant="outline" title={tech.category}>
                          {tech.name}
                        </Badge>
                      ))
                  ) : (
                    <span className="text-sm text-muted-foreground">none detected</span>
                  )}
                </div>
                {overview.technologies.some((t) => t.category === "library") ? (
                  <CollapsibleSection
                    storageKey={`arch:libs:${project}`}
                    header="Libraries"
                    count={overview.technologies.filter((t) => t.category === "library").length}
                    defaultOpen={false}
                  >
                    <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
                      {overview.technologies
                        .filter((t) => t.category === "library")
                        .map((t) => (
                          <span key={t.name}>{t.name}</span>
                        ))}
                    </div>
                  </CollapsibleSection>
                ) : null}
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
            erd={diagrams.erd}
            focusNode={focusNode}
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
                  <ul className="space-y-2">
                    {g.caps.map((c) => (
                      <li key={c.id} className="flex items-baseline justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-sm">{c.name}</span>
                          <div className="truncate">
                            <Provenance refText={c.ref} href={sourceHref(source.base, source.sha, c.ref)} />
                          </div>
                        </div>
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
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <SegmentedControl options={["grid", "list"] as const} value={compView} onChange={setCompView} />
                <SegmentedControl
                  options={(isMono ? ["package", "role", "folder"] : ["role", "folder"]) as Array<typeof compGroupBy>}
                  value={compGroupBy}
                  onChange={setCompGroupBy}
                />
              </div>
            </div>
            <RoleLegend roles={[...new Set(components.map((c) => c.role))].sort()} />
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
                  {compView === "grid" ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {items.map((c) => (
                        <Card
                          key={c.id}
                          onClick={() => openInGraph(c.id)}
                          className="cursor-pointer p-3 transition-colors hover:border-primary/40"
                          title={`${c.path} — open in graph`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="size-2 shrink-0 rounded-full" style={{ background: roleColor(c.role) }} />
                            <span className="truncate font-medium">{c.label}</span>
                          </div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">{c.responsibility}</div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <ul className="divide-y divide-border/40 overflow-hidden rounded-lg border border-border/40">
                      {items.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => openInGraph(c.id)}
                            title="Open in graph"
                            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                          >
                            <span className="size-2 shrink-0 rounded-full" style={{ background: roleColor(c.role) }} />
                            <span className="shrink-0 font-medium">{c.label}</span>
                            <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" title={c.responsibility}>
                              {c.path}
                            </span>
                            <span className="shrink-0 text-xs capitalize text-muted-foreground">{c.role}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CollapsibleSection>
              ))
            )}
          </div>
        ) : null}

        {facet === "data" && data ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {data.entities.length} entities.{" "}
              <button type="button" onClick={() => setFacet("diagrams")} className="text-primary hover:underline">
                View the ERD diagram →
              </button>
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.entities.map((e) => (
                <Card key={e.name} className="p-4">
                  <div className="font-semibold">{e.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {e.fields} field{e.fields === 1 ? "" : "s"}
                    {e.relations ? ` · ${e.relations} relation${e.relations === 1 ? "" : "s"}` : ""}
                  </div>
                  <div className="mt-1 truncate">
                    <Provenance refText={e.ref} href={sourceHref(source.base, source.sha, e.ref)} />
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
                <SegmentedControl
                  className="ml-auto"
                  options={["package", "resource"] as const}
                  value={apiGroupBy}
                  onChange={setApiGroupBy}
                />
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
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-20">Method</TableHead>
                            <TableHead>Path</TableHead>
                            <TableHead className="hidden md:table-cell">Source</TableHead>
                            <TableHead className="w-20 text-right">Protocol</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {eps.map((e) => (
                            <TableRow key={e.id}>
                              <TableCell className={`font-mono text-xs font-semibold ${METHOD_CLASS[e.method] ?? ""}`}>
                                {e.method}
                              </TableCell>
                              <TableCell className="max-w-0 truncate font-mono text-xs">{e.path}</TableCell>
                              <TableCell className="hidden md:table-cell">
                                <Provenance refText={e.ref} href={sourceHref(source.base, source.sha, e.ref)} />
                              </TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">{e.protocol}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Card>
                  </CollapsibleSection>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {facet === "deps" ? <DependenciesView project={project} technologies={technologies} /> : null}

        {facet === "skills" ? (
          skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skills matched this project.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Reusable playbooks ranked against this project&apos;s grounded model — the right skill, and{" "}
                <span className="text-success">why</span> it matched. This is the builtin shelf; extend it with{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">archmantic skill add &lt;url&gt;</code> or{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">.archmantic/skills/*.md</code>. Skills are
                recommendations — your agent decides whether to apply one.
              </p>
              <div className="grid gap-3 lg:grid-cols-2">
                {skills.map((s) => (
                  <SkillCard key={s.id} project={project} skill={s} />
                ))}
              </div>
            </div>
          )
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
