import { auth } from "@clerk/nextjs/server";
import { listSnapshots, modelAtCommit, latestModel } from "@/lib/store";
import { getProcessEdit } from "@/lib/admin";
import { modelDelta } from "@/lib/diff";
import { componentLabel, groupCapabilities, trust } from "@/lib/format";
import { componentDiagram, contextDiagram, sequenceDiagram } from "@/lib/diagrams";
import { bpmnXml } from "@/lib/bpmn";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ProjectTabs, type Group } from "../project-tabs";
import { SnapshotPicker } from "../snapshot-picker";

export const dynamic = "force-dynamic";

const BAND_CLASS: Record<string, string> = {
  high: "border-green-500/30 text-green-400",
  medium: "border-amber-500/30 text-amber-400",
  low: "border-red-500/30 text-red-400",
};

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="text-sm text-muted-foreground">
      <span className="mr-1.5 text-xl font-semibold text-foreground">{n}</span>
      {label}
    </div>
  );
}

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

  return (
    <div>
      <a href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        ← projects
      </a>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{project}</h1>
      <p className="text-sm text-muted-foreground">
        {model.components.length} components · {externals.length} external systems · {model.capabilities.length}{" "}
        capabilities{model.generatedAt ? ` · analyzed ${new Date(model.generatedAt).toLocaleString()}` : ""}
      </p>

      {snapshots.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Snapshot</span>
          <SnapshotPicker snapshots={snapshots} current={selectedSha} />
          <Badge variant="outline" className="font-normal text-muted-foreground">
            vs previous: {prevModel ? deltaSummary(d) : "first snapshot"}
          </Badge>
          {idx > 0 ? (
            <a href={`/${encodeURIComponent(project)}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Jump to latest
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
        <Card className="flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
          <Stat n={t.total} label="grounded elements" />
          <Stat n={t.refs} label="code references" />
          <Stat n={`${t.meanPct}%`} label="mean confidence" />
          <div className="ml-auto flex gap-2">
            <Badge variant="outline" className={BAND_CLASS.high}>{t.high} high</Badge>
            <Badge variant="outline" className={BAND_CLASS.medium}>{t.medium} medium</Badge>
            <Badge variant="outline" className={BAND_CLASS.low}>{t.low} low</Badge>
          </div>
        </Card>
        <Card className="flex flex-wrap content-start gap-2 p-4 lg:max-w-sm">
          <span className="w-full text-xs font-medium text-muted-foreground">External systems</span>
          {externals.length ? (
            externals.map((s) => (
              <Badge key={s.id} variant="secondary">
                {s.name}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">none</span>
          )}
        </Card>
      </div>

      <ProjectTabs
        project={project}
        groups={groups}
        components={components}
        changes={changes}
        diagrams={{
          context: contextDiagram(model),
          components: componentDiagram(model),
          sequence: sequenceDiagram(model),
          processXml: savedBpmn ?? bpmnXml(model),
          edited: Boolean(savedBpmn),
        }}
      />
    </div>
  );
}
