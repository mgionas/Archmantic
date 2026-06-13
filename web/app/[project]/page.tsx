import Link from "next/link";
import { latestModel } from "@/lib/store";
import { band, componentLabel, groupCapabilities, trust } from "@/lib/format";
import { componentDiagram, contextDiagram, sequenceDiagram } from "@/lib/diagrams";
import { bpmnXml } from "@/lib/bpmn";
import { Bpmn, Mermaid } from "../diagrams-client";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: raw } = await params;
  const project = decodeURIComponent(raw);
  const model = await latestModel(project);

  if (!model) {
    return (
      <main>
        <div className="sub">
          <Link href="/">← projects</Link>
        </div>
        <h1>{project}</h1>
        <div className="card empty">No model pushed for this project yet.</div>
      </main>
    );
  }

  const t = trust(model);
  const groups = groupCapabilities(model);
  const externals = model.systems.filter((s) => s.kind === "external");
  const proc = model.processes[0];
  const seq = sequenceDiagram(model);
  const bpmn = bpmnXml(model);

  return (
    <main>
      <div className="sub">
        <Link href="/">← projects</Link>
      </div>
      <h1>{project}</h1>
      <div className="sub">
        {model.components.length} components · {externals.length} external systems · {model.capabilities.length} capabilities
        {model.generatedAt ? ` · analyzed ${new Date(model.generatedAt).toLocaleString()}` : ""}
      </div>

      <section className="trust">
        <div className="stat">
          <span className="num">{t.total}</span>grounded elements
        </div>
        <div className="stat">
          <span className="num">{t.refs}</span>code references
        </div>
        <div className="stat">
          <span className="num">{t.meanPct}%</span>mean confidence
        </div>
        <div className="bands">
          <span className="b high">{t.high} high</span>
          <span className="b medium">{t.medium} medium</span>
          <span className="b low">{t.low} low</span>
        </div>
      </section>

      <h2>Capability map — what can this system do?</h2>
      {groups.length === 0 ? (
        <div className="empty">No capabilities.</div>
      ) : (
        <div className="grid">
          {groups.map((g) => (
            <div key={g.area} className="card area">
              <h3>{g.area}/</h3>
              <ul className="caps">
                {g.caps.map((c) => (
                  <li key={c.id}>
                    <span>{c.name}</span>
                    <span className={`badge ${band(c.confidence)}`}>
                      grounded in {c.provenance?.length ?? 0} ref{(c.provenance?.length ?? 0) === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <h2>Context</h2>
      <div className="card">
        <Mermaid id="ctx" chart={contextDiagram(model)} />
      </div>

      <h2>Components &amp; dependencies</h2>
      <div className="card">
        <Mermaid id="comp" chart={componentDiagram(model)} />
      </div>

      {seq ? (
        <>
          <h2>Sequence — {model.flows[0]?.name}</h2>
          <div className="card">
            <Mermaid id="seq" chart={seq} />
          </div>
        </>
      ) : null}

      <h2>External systems</h2>
      <div className="card">{externals.map((s) => s.name).join(" · ") || <span className="empty">none</span>}</div>

      {proc ? (
        <>
          <h2>Process (BPMN) — {proc.name}</h2>
          <div className="card">{bpmn ? <Bpmn xml={bpmn} /> : <span className="empty">no process</span>}</div>
        </>
      ) : null}

      <h2>Component responsibilities</h2>
      <div className="grid">
        {model.components.map((c) => (
          <div key={c.id} className="card">
            <div style={{ fontWeight: 600 }}>{componentLabel(c.id)}</div>
            <div className="sub">{c.responsibility ?? c.id.slice("comp:".length)}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
