import { auth } from "@clerk/nextjs/server";
import { latestModel } from "@/lib/store";
import { getProcessEdit } from "@/lib/admin";
import { componentLabel, groupCapabilities, trust } from "@/lib/format";
import { componentDiagram, contextDiagram, sequenceDiagram } from "@/lib/diagrams";
import { bpmnXml } from "@/lib/bpmn";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ProjectTabs, type Group } from "../project-tabs";

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

export default async function ProjectPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: raw } = await params;
  const project = decodeURIComponent(raw);
  const { userId, orgId } = await auth();
  const owner = orgId ?? userId;
  const model = owner ? await latestModel(owner, project) : null;

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
