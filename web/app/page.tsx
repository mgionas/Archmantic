import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { listProjects, type ProjectRow } from "@/lib/store";

export const dynamic = "force-dynamic";

const USPS: [string, string][] = [
  ["Capability map", "Plain-English “what can this system do?” — for PMs, architects, and new hires, not just engineers."],
  ["BPMN business process", "Auto-detected business processes from code — white space no code-graph tool occupies."],
  ["Provenance & trust", "Every element shows “grounded in N refs” + confidence. Verifiable, not plausible AI guesswork."],
  ["Drift & PR diffs", "“Your docs vs reality,” and how a PR reshapes the architecture — not a line diff."],
  ["MCP for agents", "Your AI agent queries the same model — ~98% fewer tokens than reading files."],
  ["Edit-then-build", "Edit the diagram; it becomes the source. Emit a build spec for an agent to implement."],
];

function Landing() {
  return (
    <main>
      <section style={{ padding: "32px 0 8px" }}>
        <h1 style={{ fontSize: 34, lineHeight: 1.15, maxWidth: 720 }}>
          A living, <em>trustworthy</em> architecture model your team and your AI agents share.
        </h1>
        <p className="sub" style={{ fontSize: 16, maxWidth: 680, marginTop: 12 }}>
          Point Archmantic at a repo → get an accurate capability map, context &amp; sequence diagrams, and an
          auto-detected BPMN process — every element grounded in code. Your agents query the same model over MCP.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <SignInButton>
            <button
              style={{ background: "#7aa2f7", color: "#0f1115", border: 0, borderRadius: 8, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 15 }}
            >
              Sign in / Get started
            </button>
          </SignInButton>
          <a
            href="https://github.com/mgionas/Archmantic"
            style={{ border: "1px solid #232734", borderRadius: 8, padding: "10px 18px", color: "#e6e9ef" }}
          >
            View on GitHub
          </a>
        </div>
      </section>

      <h2>What you get</h2>
      <div className="grid">
        {USPS.map(([title, body]) => (
          <div key={title} className="card">
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
            <div className="sub">{body}</div>
          </div>
        ))}
      </div>

      <h2>Get started</h2>
      <div className="card">
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
          <li>
            Install &amp; analyze your repo: <code>npm i -g archmantic</code> then <code>archmantic analyze</code>.
          </li>
          <li>
            Sign in here, open <strong>CLI tokens</strong>, and generate a token for your organization.
          </li>
          <li>
            Add <code>ARCHMANTIC_TOKEN</code> + <code>ARCHMANTIC_API_URL</code> to your repo&apos;s{" "}
            <code>.env.local</code>, then run <code>archmantic push</code>.
          </li>
          <li>Your model appears here — capability map, diagrams, trust, and an editable BPMN canvas.</li>
        </ol>
      </div>
    </main>
  );
}

export default async function Home() {
  const { userId, orgId } = await auth().catch(() => ({ userId: null, orgId: null }));
  if (!userId) return <Landing />;

  const owner = orgId ?? userId;
  let projects: ProjectRow[] = [];
  let error: string | null = null;
  try {
    if (owner) projects = await listProjects(owner);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main>
      <h1>Your projects</h1>
      <div className="sub">
        Shared architecture knowledge for your organization. <Link href="/settings">Manage CLI tokens →</Link>
      </div>

      <h2>Projects</h2>
      {error ? (
        <div className="card empty">Could not reach the store: {error}</div>
      ) : projects.length === 0 ? (
        <div className="card empty">
          No projects in this organization yet. Get a <Link href="/settings">CLI token</Link>, then run{" "}
          <code>archmantic push</code> in a repo.
        </div>
      ) : (
        <div className="grid">
          {projects.map((p) => (
            <Link key={p.project} href={`/${encodeURIComponent(p.project)}`} className="card">
              <div style={{ fontWeight: 600, fontSize: 16 }}>{p.project}</div>
              <div className="sub" style={{ marginTop: 6 }}>
                {p.snapshots} commit snapshot{p.snapshots === 1 ? "" : "s"} · updated{" "}
                {new Date(p.latest).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
