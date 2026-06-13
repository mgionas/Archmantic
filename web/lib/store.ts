import { neon } from "@neondatabase/serverless";

/** Minimal shape of the IR we render in the web viewer (mirrors the CLI's IR). */
export interface Provenance {
  ref: string;
  source: string;
  confidence?: number;
}
export interface Element {
  id: string;
  name: string;
  description?: string;
  responsibility?: string;
  kind?: string;
  confidence: number;
  provenance: Provenance[];
  componentIds?: string[];
}
export interface Model {
  project: string;
  generatedAt?: string;
  systems: Element[];
  components: Element[];
  relations: (Element & { from: string; to: string })[];
  capabilities: Element[];
  processes: { id: string; name: string; description?: string; confidence: number; tasks: { id: string; name: string }[] }[];
  flows: (Element & {
    participants: string[];
    steps: { participant: string; action: string; to?: string }[];
  })[];
}

export interface ProjectRow {
  project: string;
  snapshots: number;
  latest: string;
}

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add the Neon connection string to the environment.");
  return neon(url);
}

function missingTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === "42P01" || /relation .* does not exist/i.test(e?.message ?? "");
}

export async function listProjects(owner: string): Promise<ProjectRow[]> {
  try {
    const rows = await sql()`
      select project, count(*)::int as snapshots, max(pushed_at) as latest
      from archmantic_models where owner = ${owner} group by project order by project`;
    return rows as ProjectRow[];
  } catch (err) {
    if (missingTable(err)) return [];
    throw err;
  }
}

export async function latestModel(owner: string, project: string): Promise<Model | null> {
  try {
    const rows = (await sql()`
      select model from archmantic_models
      where owner = ${owner} and project = ${project} order by pushed_at desc limit 1`) as { model: Model }[];
    return rows[0]?.model ?? null;
  } catch (err) {
    if (missingTable(err)) return null;
    throw err;
  }
}
