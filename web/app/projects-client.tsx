"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ProjectRow } from "@/lib/store";

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ProjectsClient({ projects }: { projects: ProjectRow[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "name">("recent");

  const shown = useMemo(() => {
    const filtered = projects.filter((p) => p.project.toLowerCase().includes(q.toLowerCase()));
    return [...filtered].sort((a, b) =>
      sort === "name"
        ? a.project.localeCompare(b.project)
        : new Date(b.latest).getTime() - new Date(a.latest).getTime(),
    );
  }, [projects, q, sort]);

  return (
    <>
      <div className="mb-5 flex items-center gap-3">
        <Input
          placeholder="Search projects…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Button variant="ghost" size="sm" onClick={() => setSort((s) => (s === "recent" ? "name" : "recent"))}>
          Sort: {sort === "recent" ? "recently updated" : "name"}
        </Button>
        <span className="ml-auto text-sm text-muted-foreground">
          {shown.length} of {projects.length}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects match “{q}”.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <Link key={p.project} href={`/${encodeURIComponent(p.project)}`} className="group">
              <Card className="h-full p-5 transition-colors group-hover:border-primary/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate text-base font-semibold">{p.project}</div>
                  <Badge variant="secondary" className="shrink-0">
                    {p.snapshots} {p.snapshots === 1 ? "snapshot" : "snapshots"}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline">{p.components} components</Badge>
                  <Badge variant="outline">{p.capabilities} capabilities</Badge>
                </div>
                <div className="mt-4 text-xs text-muted-foreground">updated {relativeTime(p.latest)}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
