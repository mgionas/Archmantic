/**
 * Cloud knowledge store — share the architecture model across a team via Neon
 * Postgres. Each push stores the model under (project, commit), so the DB holds
 * a per-commit history: teammates `pull` the latest shared model, and the
 * before/after-commit timeline lives in the cloud, not just one laptop.
 *
 * This is the local-first → platform bridge (docs/ARCHITECTURE.md §store): the
 * repo's committed `.archmantic/model.json` stays the source of truth; the DB is
 * a shared cache/index. Connection is BYO via DATABASE_URL in `.env.local`.
 *
 * Uses @neondatabase/serverless `neon()` (HTTP) — no pool/socket to manage, and
 * the same driver the future Vercel platform will use.
 */
import { neon } from "@neondatabase/serverless";
import { type ArchitectureModel } from "../ir/types.js";

export class NoDatabaseError extends Error {}

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new NoDatabaseError("DATABASE_URL not set — add your Neon connection string to .env.local.");
  }
  return neon(url);
}

/** Postgres "undefined_table" (42P01) — the store hasn't been created by a push yet. */
function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === "42P01" || /relation .* does not exist/i.test(e?.message ?? "");
}

export async function ensureSchema(): Promise<void> {
  const q = sql();
  await q`
    create table if not exists archmantic_models (
      project      text        not null,
      commit_sha   text        not null,
      generated_at timestamptz,
      pushed_at    timestamptz not null default now(),
      model        jsonb       not null,
      primary key (project, commit_sha)
    )`;
}

/** Upsert the model under (project, commit). Returns the project key used. */
export async function pushModel(model: ArchitectureModel, commitSha: string): Promise<void> {
  await ensureSchema();
  const q = sql();
  await q`
    insert into archmantic_models (project, commit_sha, generated_at, model)
    values (${model.project}, ${commitSha}, ${model.generatedAt ?? null}, ${JSON.stringify(model)})
    on conflict (project, commit_sha)
    do update set model = excluded.model, generated_at = excluded.generated_at, pushed_at = now()`;
}

/** Latest shared model for a project, or null if none has been pushed. */
export async function pullLatest(project: string): Promise<ArchitectureModel | null> {
  const q = sql();
  try {
    const rows = (await q`
      select model from archmantic_models
      where project = ${project}
      order by pushed_at desc
      limit 1`) as { model: ArchitectureModel }[];
    return rows[0]?.model ?? null;
  } catch (err) {
    if (isMissingTable(err)) return null; // nothing pushed yet
    throw err;
  }
}

export interface CloudSnapshot {
  commit_sha: string;
  generated_at: string | null;
  pushed_at: string;
}

/** Per-commit snapshots for a project, newest first. */
export async function history(project: string): Promise<CloudSnapshot[]> {
  const q = sql();
  try {
    return (await q`
      select commit_sha, generated_at, pushed_at from archmantic_models
      where project = ${project}
      order by pushed_at desc`) as CloudSnapshot[];
  } catch (err) {
    if (isMissingTable(err)) return []; // nothing pushed yet
    throw err;
  }
}
