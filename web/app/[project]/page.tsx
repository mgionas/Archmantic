import { auth } from "@clerk/nextjs/server";
import { latestModel } from "@/lib/store";
import { getProcessEdit } from "@/lib/admin";
import { band, componentLabel, groupCapabilities, trust } from "@/lib/format";
import { componentDiagram, contextDiagram, sequenceDiagram } from "@/lib/diagrams";
import { bpmnXml } from "@/lib/bpmn";
import { DiagramTabs } from "../diagram-tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const BAND_CLASS: Record<string, string> = {
  high: "border-green-500/30 text-green-400",
  medium: "border-amber-500/30 text-amber-400",
  low: "border-red-500/30 text-red-400",
};

function Section({ title, extra, children }: { title: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        {title}
        {extra}
      </h2>
      {children}
    </section>
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
  const groups = groupCapabilities(model);
  const externals = model.systems.filter((s) => s.kind === "external");
  const seq = sequenceDiagram(model);
  const generatedBpmn = bpmnXml(model);
  const savedBpmn = owner ? await getProcessEdit(owner, project) : null;
  const processXml = savedBpmn ?? generatedBpmn;

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

      <Card className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
        <Stat n={t.total} label="grounded elements" />
        <Stat n={t.refs} label="code references" />
        <Stat n={`${t.meanPct}%`} label="mean confidence" />
        <div className="ml-auto flex gap-2">
          <Badge variant="outline" className={BAND_CLASS.high}>{t.high} high</Badge>
          <Badge variant="outline" className={BAND_CLASS.medium}>{t.medium} medium</Badge>
          <Badge variant="outline" className={BAND_CLASS.low}>{t.low} low</Badge>
        </div>
      </Card>

      <Section title="Capability map" extra={<span className="text-sm font-normal text-muted-foreground">what can this system do?</span>}>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No capabilities.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <Card key={g.area} className="p-4">
                <div className="mb-2 font-mono text-xs text-muted-foreground">{g.area}/</div>
                <ul className="space-y-1.5">
                  {g.caps.map((c) => (
                    <li key={c.id} className="flex items-baseline justify-between gap-2">
                      <span className="text-sm">{c.name}</span>
                      <Badge variant="outline" className={`shrink-0 ${BAND_CLASS[band(c.confidence)]}`}>
                        {c.provenance?.length ?? 0} ref{(c.provenance?.length ?? 0) === 1 ? "" : "s"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title="Diagrams">
        <Card className="p-4">
          <DiagramTabs
            project={project}
            context={contextDiagram(model)}
            components={componentDiagram(model)}
            sequence={seq}
            processXml={processXml}
            edited={Boolean(savedBpmn)}
          />
        </Card>
      </Section>

      <Section title="External systems">
        <Card className="flex flex-wrap gap-2 p-4">
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
      </Section>

      <Section title="Component responsibilities">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {model.components.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="font-semibold">{componentLabel(c.id)}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {c.responsibility ?? c.id.slice("comp:".length)}
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="text-sm text-muted-foreground">
      <span className="mr-1.5 text-xl font-semibold text-foreground">{n}</span>
      {label}
    </div>
  );
}
