import Link from "next/link";
import { listProjects, type ProjectRow } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  let projects: ProjectRow[] = [];
  let error: string | null = null;
  try {
    projects = await listProjects();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main>
      <h1>Archmantic</h1>
      <div className="sub">Shared architecture knowledge — pushed from the CLI, read by your team.</div>

      <h2>Projects</h2>
      {error ? (
        <div className="card empty">Could not reach the store: {error}</div>
      ) : projects.length === 0 ? (
        <div className="card empty">
          No projects yet. Run <code>archmantic push</code> in a repo to share its model.
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
