/**
 * Cloud knowledge store — share the architecture model across a team via Neon
 * Postgres. Each push stores the model under (owner, project, commit), so the DB
 * holds a per-owner, per-commit history: teammates `pull` the latest shared
 * model, and the before/after-commit timeline lives in the cloud.
 *
 * Direct/self-host mode (this file) tags rows with a fixed `owner` (default
 * "local", overridable via ARCHMANTIC_OWNER). The SaaS API tags rows with the
 * caller's org. `owner` is part of the primary key, so different orgs can hold
 * the same project + commit independently.
 *
 * Uses @neondatabase/serverless `neon()` (HTTP) — same driver the platform uses.
 */
import { neon } from "@neondatabase/serverless";
import { type ArchitectureModel } from "../ir/types.js";

export class NoDatabaseError extends Error {}

/** Owner namespace for direct (self-host) pushes. */
const OWNER = process.env.ARCHMANTIC_OWNER ?? "local";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new NoDatabaseError("DATABASE_URL not set — add your Neon connection string to .env.local.");
  }
  return neon(url);
}

function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === "42P01" || /relation .* does not exist/i.test(e?.message ?? "");
}

/**
 * Idempotent schema + migration. Fresh DBs get the composite PK directly; older
 * tables (PK on just project+commit) are migrated in place: backfill owner,
 * make it NOT NULL, and swap the primary key to (owner, project, commit_sha).
 */
export async function ensureSchema(): Promise<void> {
  const q = sql();
  await q`
    create table if not exists archmantic_models (
      project      text        not null,
      commit_sha   text        not null,
      generated_at timestamptz,
      pushed_at    timestamptz not null default now(),
      model        jsonb       not null,
      owner        text        not null default 'local',
      primary key (owner, project, commit_sha)
    )`;
  await q`alter table archmantic_models add column if not exists owner text`;
  await q`update archmantic_models set owner = 'local' where owner is null`;

  const pkCols = (await q`
    select a.attname from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
    where i.indrelid = 'archmantic_models'::regclass and i.indisprimary`) as { attname: string }[];
  if (!pkCols.some((r) => r.attname === "owner")) {
    await q`alter table archmantic_models alter column owner set not null`;
    await q`alter table archmantic_models drop constraint if exists archmantic_models_pkey`;
    await q`alter table archmantic_models add primary key (owner, project, commit_sha)`;
  }
}

/** Upsert the model under (owner, project, commit) for the direct/self-host owner. */
export async function pushModel(model: ArchitectureModel, commitSha: string): Promise<void> {
  await ensureSchema();
  const q = sql();
  await q`
    insert into archmantic_models (owner, project, commit_sha, generated_at, model)
    values (${OWNER}, ${model.project}, ${commitSha}, ${model.generatedAt ?? null}, ${JSON.stringify(model)})
    on conflict (owner, project, commit_sha)
    do update set model = excluded.model, generated_at = excluded.generated_at, pushed_at = now()`;
}

/** Latest model for a project in the direct/self-host owner namespace. */
export async function pullLatest(project: string): Promise<ArchitectureModel | null> {
  const q = sql();
  try {
    const rows = (await q`
      select model from archmantic_models
      where owner = ${OWNER} and project = ${project}
      order by pushed_at desc
      limit 1`) as { model: ArchitectureModel }[];
    return rows[0]?.model ?? null;
  } catch (err) {
    if (isMissingTable(err)) return null;
    throw err;
  }
}

// ── MCP usage stats (proof-of-value + metering substrate) ─────────────────────

/** One recorded MCP tool call. `id` is a UUID → inserts are idempotent (the MCP
 *  auto-flush and a later `usage --sync` can push the same event safely). */
export interface UsageEvent {
  id: string;
  project: string;
  tool: string;
  tokensOut: number;
  tokensSaved: number;
  at: string; // ISO timestamp
}

export async function ensureUsageSchema(): Promise<void> {
  const q = sql();
  await q`
    create table if not exists archmantic_usage (
      id           uuid        primary key,
      owner        text        not null,
      project      text        not null,
      tool         text        not null,
      tokens_out   integer     not null default 0,
      tokens_saved integer     not null default 0,
      at           timestamptz not null
    )`;
  await q`create index if not exists archmantic_usage_owner_at on archmantic_usage (owner, at desc)`;
}

/** Record a batch of usage events for the direct/self-host owner (idempotent). */
export async function recordUsage(events: UsageEvent[]): Promise<void> {
  if (!events.length) return;
  await ensureUsageSchema();
  await sql()`
    insert into archmantic_usage (id, owner, project, tool, tokens_out, tokens_saved, at)
    select (e->>'id')::uuid, ${OWNER}, e->>'project', e->>'tool',
           (e->>'tokensOut')::int, (e->>'tokensSaved')::int, (e->>'at')::timestamptz
    from jsonb_array_elements(${JSON.stringify(events)}::jsonb) e
    on conflict (id) do nothing`;
}

export interface CloudSnapshot {
  commit_sha: string;
  generated_at: string | null;
  pushed_at: string;
}

/** Per-commit snapshots for a project (direct/self-host owner), newest first. */
export async function history(project: string): Promise<CloudSnapshot[]> {
  const q = sql();
  try {
    return (await q`
      select commit_sha, generated_at, pushed_at from archmantic_models
      where owner = ${OWNER} and project = ${project}
      order by pushed_at desc`) as CloudSnapshot[];
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}
