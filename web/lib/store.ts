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
  role?: string;
  confidence: number;
  provenance: Provenance[];
  componentIds?: string[];
  /** Monorepo: owning workspace member dir (e.g. "apps/api"). */
  package?: string;
}
export interface DataField {
  name: string;
  type: string;
  optional?: boolean;
  list?: boolean;
  isId?: boolean;
  isUnique?: boolean;
  relationTo?: string;
  isForeignKey?: boolean;
}
export interface DataEntity extends Element {
  fields: DataField[];
}
export interface Endpoint extends Element {
  method: string;
  path: string;
  protocol: "rest" | "trpc" | "graphql";
}
export interface ProjectManifest {
  goal?: string;
  status?: string;
  author?: { name: string; email?: string; url?: string };
  owners?: string[];
  links?: { label: string; url: string }[];
  agents?: { name: string; role?: string; file?: string }[];
  history?: { date?: string; note: string }[];
}
export interface Model {
  project: string;
  generatedAt?: string;
  system?: string;
  consumes?: string[];
  workspaces?: string[];
  manifest?: ProjectManifest;
  systems: Element[];
  components: Element[];
  relations: (Element & { from: string; to: string })[];
  capabilities: Element[];
  technologies?: { name: string; category: string }[];
  dataEntities?: DataEntity[];
  endpoints?: Endpoint[];
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
  components: number;
  capabilities: number;
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
      select distinct on (m.project)
        m.project,
        m.pushed_at as latest,
        coalesce(jsonb_array_length(m.model->'components'), 0) as components,
        coalesce(jsonb_array_length(m.model->'capabilities'), 0) as capabilities,
        (select count(*)::int from archmantic_models s where s.owner = ${owner} and s.project = m.project) as snapshots
      from archmantic_models m
      where m.owner = ${owner}
      order by m.project, m.pushed_at desc`;
    return rows as ProjectRow[];
  } catch (err) {
    if (missingTable(err)) return [];
    throw err;
  }
}

/** Latest model per project for an owner — for the multi-repo system view. */
export async function latestModelsForOwner(owner: string): Promise<Model[]> {
  try {
    const rows = (await sql()`
      select distinct on (project) model from archmantic_models
      where owner = ${owner} order by project, pushed_at desc`) as { model: Model }[];
    return rows.map((r) => r.model);
  } catch (err) {
    if (missingTable(err)) return [];
    throw err;
  }
}

export interface Snapshot {
  commit_sha: string;
  generated_at: string | null;
  pushed_at: string;
}

/** Per-commit snapshots for a project (newest first) — the architecture timeline. */
export async function listSnapshots(owner: string, project: string): Promise<Snapshot[]> {
  try {
    return (await sql()`
      select commit_sha, generated_at, pushed_at from archmantic_models
      where owner = ${owner} and project = ${project}
      order by pushed_at desc`) as Snapshot[];
  } catch (err) {
    if (missingTable(err)) return [];
    throw err;
  }
}

/** The model stored at a specific commit. */
export async function modelAtCommit(owner: string, project: string, commit: string): Promise<Model | null> {
  try {
    const rows = (await sql()`
      select model from archmantic_models
      where owner = ${owner} and project = ${project} and commit_sha = ${commit} limit 1`) as { model: Model }[];
    return rows[0]?.model ?? null;
  } catch (err) {
    if (missingTable(err)) return null;
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
