import { auth } from "@clerk/nextjs/server";
import { latestModelsForOwner } from "@/lib/store";
import { analyzeLinks } from "@/lib/system";
import { componentLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { KnowledgeHub } from "@/components/knowledge-hub";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const { userId, orgId } = await auth();
  const owner = orgId ?? userId;
  const models = owner ? await latestModelsForOwner(owner) : [];

  const projects = models
    .map((m) => ({
      project: m.project,
      system: m.system ?? null,
      components: m.components.length,
      capabilities: m.capabilities.length,
      endpoints: m.endpoints?.length ?? 0,
      entities: m.dataEntities?.length ?? 0,
      technologies: (m.technologies ?? []).map((t) => t.name),
    }))
    .sort((a, b) => a.project.localeCompare(b.project));

  const capabilities = models.flatMap((m) => m.capabilities.map((c) => ({ name: c.name, project: m.project })));
  const endpoints = models.flatMap((m) =>
    (m.endpoints ?? []).map((e) => ({ method: e.method, path: e.path, protocol: e.protocol, project: m.project })),
  );
  const entities = models.flatMap((m) =>
    (m.dataEntities ?? []).map((e) => ({
      name: e.name,
      project: m.project,
      fields: e.fields.filter((f) => !f.relationTo).length,
    })),
  );
  const components = models.flatMap((m) => m.components.map((c) => ({ name: componentLabel(c.id), project: m.project })));

  const stackMap = new Map<string, Set<string>>();
  for (const m of models)
    for (const t of m.technologies ?? []) (stackMap.get(t.name) ?? stackMap.set(t.name, new Set()).get(t.name)!).add(m.project);
  const stack = [...stackMap.entries()]
    .map(([name, projects]) => ({ name, projects: [...projects] }))
    .sort((a, b) => b.projects.length - a.projects.length || a.name.localeCompare(b.name));

  const linkCounts = analyzeLinks(models).counts;

  const totals = {
    projects: models.length,
    components: components.length,
    capabilities: capabilities.length,
    endpoints: endpoints.length,
    entities: entities.length,
  };

  if (!models.length) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Org knowledge</h1>
        <p className="mb-6 text-sm text-muted-foreground">One searchable view across every repo in your organization.</p>
        <Card className="p-6 text-sm text-muted-foreground">
          No projects yet. Run <code className="rounded bg-muted px-1.5 py-0.5">archmantic push</code> in your repos and
          they&apos;ll show up here.
        </Card>
      </div>
    );
  }

  return (
    <KnowledgeHub
      totals={totals}
      projects={projects}
      capabilities={capabilities}
      endpoints={endpoints}
      entities={entities}
      components={components}
      stack={stack}
      linkCounts={linkCounts}
    />
  );
}
