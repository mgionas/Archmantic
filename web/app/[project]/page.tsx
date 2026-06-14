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
  sequenceDeck,
} from "@/lib/diagrams";
import { bpmnXml } from "@/lib/bpmn";
import { knowledgeMarkdown } from "@/lib/knowledge";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
        <EmptyState title="No model pushed for this project yet">
          From the repo root, run <code className="rounded bg-muted px-1.5 py-0.5">archmantic analyze</code> then{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">archmantic push</code> (with your token set) to publish it here.
        </EmptyState>
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
    role: c.role ?? "module",
    path: c.id.slice("comp:".length),
    responsibility: c.responsibility ?? c.id.slice("comp:".length),
    package: c.package,
  }));
  const d = modelDelta(prevModel, model);

  const endpoints = (model.endpoints ?? []).map((e) => ({
    id: e.id,
    method: e.method,
    path: e.path,
    protocol: e.protocol,
    package: e.package,
  }));

  const featureName = new Map<string, string>();
  for (const f of model.features ?? []) featureName.set(f.id, f.name);
  const nodeLabel = (id: string) =>
    id.startsWith("comp:") ? componentLabel(id) : id.replace(/^sys:ext:/, "");
  const flowByFeature = new Map<string, { from: string; action: string; to: string }[]>();
  for (const fl of model.flows ?? []) {
    if (!fl.featureId) continue;
    flowByFeature.set(
      fl.featureId,
      fl.steps.map((s) => ({ from: nodeLabel(s.participant), action: s.action, to: nodeLabel(s.to ?? s.participant) })),
    );
  }
  const features = (model.features ?? [])
    .map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description ?? "",
      status: f.status ?? null,
      shows: f.shows ?? [],
      actions: f.actions ?? [],
      dependsOn: (f.dependsOn ?? []).map((id) => featureName.get(id) ?? id.replace(/^feature:/, "")),
      components: (f.components ?? []).map((c) => componentLabel(c)),
      componentPaths: (f.components ?? []).map((c) => c.replace(/^comp:/, "")),
      flow: flowByFeature.get(f.id) ?? [],
      human: f.provenance?.[0]?.source === "human",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

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
    manifest: model.manifest ?? null,
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
        features={features}
        workspaces={model.workspaces ?? []}
        knowledge={knowledgeMarkdown(model)}
        diagrams={{
          contextGraph: contextGraph(model),
          contextDetails: contextDetails(model),
          componentGraph: componentGraph(model),
          componentDetails: componentDetails(model),
          sequences: sequenceDeck(model),
          processXml: savedBpmn ?? bpmnXml(model),
          edited: Boolean(savedBpmn),
        }}
      />
    </div>
  );
}
