import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { listSnapshots, modelAtCommit, latestModel } from "@/lib/store";
import { getProcessEdit } from "@/lib/admin";
import { modelDelta } from "@/lib/diff";
import { componentLabel, groupCapabilities, trust } from "@/lib/format";
import {
  componentGraph,
  componentDetails,
  contextGraph,
  contextDetails,
  entityGraph,
  sequenceDiagram,
} from "@/lib/diagrams";
import { bpmnXml } from "@/lib/bpmn";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ProjectTabs, type Group } from "../project-tabs";
import { SnapshotPicker } from "../snapshot-picker";

export const dynamic = "force-dynamic";

function deltaSummary(d: ReturnType<typeof modelDelta>): string {
  const parts: string[] = [];
  const seg = (label: string, a: number, r: number) => {
    if (a) parts.push(`+${a} ${label}`);
    if (r) parts.push(`−${r} ${label}`);
  };
  seg("components", d.components.added.length, d.components.removed.length);
  seg("capabilities", d.capabilities.added.length, d.capabilities.removed.length);
  seg("external systems", d.externals.added.length, d.externals.removed.length);
  return parts.length ? parts.join(" · ") : "no architecture change";
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ commit?: string }>;
}) {
  const { project: raw } = await params;
  const { commit } = await searchParams;
  const project = decodeURIComponent(raw);
  const { userId, orgId } = await auth();
  const owner = orgId ?? userId;

  const snapshots = owner ? await listSnapshots(owner, project) : [];
  const selectedSha = (commit && snapshots.some((s) => s.commit_sha === commit) ? commit : snapshots[0]?.commit_sha) ?? "";
  const model = owner && selectedSha ? await modelAtCommit(owner, project, selectedSha) : owner ? await latestModel(owner, project) : null;

  // delta vs the previous snapshot (the one pushed just before the selected one)
  const idx = snapshots.findIndex((s) => s.commit_sha === selectedSha);
  const prevSha = idx >= 0 ? snapshots[idx + 1]?.commit_sha : undefined;
  const prevModel = owner && prevSha ? await modelAtCommit(owner, project, prevSha) : null;

  if (!model) {
    return (
      <div className="space-y-4">
        <a href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          ← projects
        </a>
        <h1 className="text-2xl font-bold">{project}</h1>
        <Card className="p-6 text-sm text-muted-foreground">No model pushed for this project yet.</Card>
      </div>
    );
  }

  const t = trust(model);
  const externals = model.systems.filter((s) => s.kind === "external");
  const savedBpmn = owner ? await getProcessEdit(owner, project) : null;

  const groups: Group[] = groupCapabilities(model).map((g) => ({
    area: g.area,
    caps: g.caps.map((c) => ({
      id: c.id,
      name: c.name,
      refs: c.provenance?.length ?? 0,
      confidence: c.confidence,
    })),
  }));
  const components = model.components.map((c) => ({
    id: c.id,
    label: componentLabel(c.id),
    responsibility: c.responsibility ?? c.id.slice("comp:".length),
  }));
  const d = modelDelta(prevModel, model);

  const endpoints = (model.endpoints ?? []).map((e) => ({
    id: e.id,
    method: e.method,
    path: e.path,
    protocol: e.protocol,
  }));

  const eg = entityGraph(model);
  const data = eg.nodes.length
    ? {
        graph: eg,
        entities: (model.dataEntities ?? []).map((e) => ({
          name: e.name,
          fields: e.fields.filter((f) => !f.relationTo).length,
          relations: e.fields.filter((f) => f.relationTo).length,
        })),
      }
    : null;

  const capName = new Map<string, string>();
  for (const c of model.capabilities) capName.set(c.id, c.name);
  if (prevModel) for (const c of prevModel.capabilities) capName.set(c.id, c.name);
  const extName = (id: string) => id.slice("sys:ext:".length);
  const changes = {
    hasPrev: Boolean(prevModel),
    total: d.total,
    components: { added: d.components.added.map(componentLabel), removed: d.components.removed.map(componentLabel) },
    capabilities: {
      added: d.capabilities.added.map((id) => capName.get(id) ?? id),
      removed: d.capabilities.removed.map((id) => capName.get(id) ?? id),
    },
    externals: { added: d.externals.added.map(extName), removed: d.externals.removed.map(extName) },
  };

  const overview = {
    trust: { total: t.total, refs: t.refs, meanPct: t.meanPct, high: t.high, medium: t.medium, low: t.low },
    externals: externals.map((s) => s.name),
    technologies: (model.technologies ?? []).map((tech) => ({ name: tech.name, category: tech.category })),
    analyzedAt: model.generatedAt ?? null,
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{project}</h1>
        <span className="text-sm text-muted-foreground">
          {model.components.length} components · {externals.length} external · {model.capabilities.length} capabilities
        </span>
        {snapshots.length > 0 ? (
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <SnapshotPicker snapshots={snapshots} current={selectedSha} />
            <Badge variant="outline" className="font-normal text-muted-foreground">
              vs previous: {prevModel ? deltaSummary(d) : "first snapshot"}
            </Badge>
            {idx > 0 ? (
              <Link href={`/${encodeURIComponent(project)}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Jump to latest
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <ProjectTabs
        project={project}
        overview={overview}
        groups={groups}
        components={components}
        changes={changes}
        data={data}
        endpoints={endpoints}
        diagrams={{
          contextGraph: contextGraph(model),
          contextDetails: contextDetails(model),
          componentGraph: componentGraph(model),
          componentDetails: componentDetails(model),
          sequence: sequenceDiagram(model),
          processXml: savedBpmn ?? bpmnXml(model),
          edited: Boolean(savedBpmn),
        }}
      />
    </div>
  );
}
