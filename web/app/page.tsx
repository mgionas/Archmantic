import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { listProjects, type ProjectRow } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { userId, orgId } = await auth();
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
      <h1>Archmantic</h1>
      <div className="sub">Shared architecture knowledge — pushed from the CLI, read by your team.</div>

      <h2>
        Projects <Link href="/settings" style={{ fontSize: 13, fontWeight: 400, marginLeft: 10 }}>CLI token →</Link>
      </h2>
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
