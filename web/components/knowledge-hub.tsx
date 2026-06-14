"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";

interface Totals {
  projects: number;
  components: number;
  capabilities: number;
  endpoints: number;
  entities: number;
}
interface ProjectRow {
  project: string;
  system: string | null;
  components: number;
  capabilities: number;
  endpoints: number;
  entities: number;
  technologies: string[];
}

const LIMIT = 40;
const proj = (p: string) => `/${encodeURIComponent(p)}`;

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <Card className="p-4">
      <div className="text-2xl font-bold tabular-nums tracking-tight">{value}</div>
      <div className="mt-0.5 text-sm text-muted-foreground">{label}</div>
    </Card>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ href, left, right }: { href: string; left: React.ReactNode; right: string }) {
  return (
    <Link href={href} className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1 text-sm hover:bg-muted">
      <span className="min-w-0 truncate">{left}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{right}</span>
    </Link>
  );
}

export function KnowledgeHub({
  totals,
  projects,
  capabilities,
  endpoints,
  entities,
  components,
  stack,
  linkCounts,
}: {
  totals: Totals;
  projects: ProjectRow[];
  capabilities: { name: string; project: string }[];
  endpoints: { method: string; path: string; protocol: string; project: string }[];
  entities: { name: string; project: string; fields: number }[];
  components: { name: string; project: string }[];
  stack: { name: string; projects: string[] }[];
  linkCounts: { connected: number; inferred: number; dangling: number };
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (query.length < 2) return null;
    const has = (s: string) => s.toLowerCase().includes(query);
    return {
      capabilities: capabilities.filter((c) => has(c.name)).slice(0, LIMIT),
      endpoints: endpoints.filter((e) => has(`${e.method} ${e.path}`)).slice(0, LIMIT),
      entities: entities.filter((e) => has(e.name)).slice(0, LIMIT),
      components: components.filter((c) => has(c.name)).slice(0, LIMIT),
      projects: projects.filter((p) => has(p.project)).slice(0, LIMIT),
    };
  }, [query, capabilities, endpoints, entities, components, projects]);

  const resultCount = results
    ? results.capabilities.length + results.endpoints.length + results.entities.length + results.components.length + results.projects.length
    : 0;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Org knowledge</h1>
          <p className="text-sm text-muted-foreground">
            One searchable view across every repo — capabilities, APIs, data, and components.
          </p>
        </div>
        <Link href="/systems" className={buttonVariants({ variant: "outline" })}>
          Systems & links
        </Link>
      </div>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search capabilities, endpoints, entities, components, projects…"
        className="mb-6 max-w-xl"
      />

      {results ? (
        resultCount === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">No matches for “{q}”.</Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {results.projects.length ? (
              <ResultGroup title={`Projects (${results.projects.length})`}>
                {results.projects.map((p) => (
                  <Row key={p.project} href={proj(p.project)} left={<span className="font-medium">{p.project}</span>} right={`${p.components} comp`} />
                ))}
              </ResultGroup>
            ) : null}
            {results.capabilities.length ? (
              <ResultGroup title={`Capabilities (${results.capabilities.length})`}>
                {results.capabilities.map((c, i) => (
                  <Row key={`${c.project}-${c.name}-${i}`} href={`${proj(c.project)}?view=capabilities`} left={c.name} right={c.project} />
                ))}
              </ResultGroup>
            ) : null}
            {results.endpoints.length ? (
              <ResultGroup title={`Endpoints (${results.endpoints.length})`}>
                {results.endpoints.map((e, i) => (
                  <Row
                    key={`${e.project}-${e.method}-${e.path}-${i}`}
                    href={`${proj(e.project)}?view=api`}
                    left={
                      <span className="font-mono text-xs">
                        <span className="text-muted-foreground">{e.method}</span> {e.path}
                      </span>
                    }
                    right={e.project}
                  />
                ))}
              </ResultGroup>
            ) : null}
            {results.entities.length ? (
              <ResultGroup title={`Data entities (${results.entities.length})`}>
                {results.entities.map((e, i) => (
                  <Row key={`${e.project}-${e.name}-${i}`} href={`${proj(e.project)}?view=data`} left={e.name} right={e.project} />
                ))}
              </ResultGroup>
            ) : null}
            {results.components.length ? (
              <ResultGroup title={`Components (${results.components.length})`}>
                {results.components.map((c, i) => (
                  <Row key={`${c.project}-${c.name}-${i}`} href={`${proj(c.project)}?view=components`} left={<span className="font-mono text-xs">{c.name}</span>} right={c.project} />
                ))}
              </ResultGroup>
            ) : null}
          </div>
        )
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Stat value={totals.projects} label="projects" />
            <Stat value={totals.components} label="components" />
            <Stat value={totals.capabilities} label="capabilities" />
            <Stat value={totals.endpoints} label="endpoints" />
            <Stat value={totals.entities} label="data entities" />
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Projects</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <Link key={p.project} href={proj(p.project)} className="group">
                  <Card className="h-full p-4 transition-colors group-hover:border-primary/50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{p.project}</span>
                      {p.system ? <Badge variant="secondary">{p.system}</Badge> : null}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {p.components} comp · {p.capabilities} cap · {p.endpoints} api · {p.entities} data
                    </div>
                    {p.technologies.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {p.technologies.slice(0, 6).map((t) => (
                          <Badge key={t} variant="outline" className="text-[11px]">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          {stack.length ? (
            <div>
              <h2 className="mb-3 text-lg font-semibold">Tech stack across the org</h2>
              <Card className="flex flex-wrap gap-2 p-5">
                {stack.map((t) => (
                  <Badge key={t.name} variant="outline" title={`${t.projects.length} repo${t.projects.length === 1 ? "" : "s"}: ${t.projects.join(", ")}`}>
                    {t.name}
                    <span className="ml-1.5 text-muted-foreground">{t.projects.length}</span>
                  </Badge>
                ))}
              </Card>
            </div>
          ) : null}

          <div>
            <h2 className="mb-3 text-lg font-semibold">Cross-repo links</h2>
            <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-5 text-sm">
              <span>
                <span className="font-semibold text-success">{linkCounts.connected}</span> connected
              </span>
              <span>
                <span className="font-semibold text-warning">{linkCounts.inferred}</span> inferred
              </span>
              <span>
                <span className="font-semibold text-danger">{linkCounts.dangling}</span> dangling
              </span>
              <Link href="/systems" className="ml-auto text-primary hover:underline">
                Review in Systems →
              </Link>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
