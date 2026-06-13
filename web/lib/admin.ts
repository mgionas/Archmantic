import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes } from "node:crypto";
import type { Model } from "./store";

/** Server-only writes: API token issuance/verification + org-scoped push. */

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  return neon(url);
}

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function ensureSchema(): Promise<void> {
  const q = db();
  await q`
    create table if not exists archmantic_models (
      project text not null, commit_sha text not null,
      generated_at timestamptz, pushed_at timestamptz not null default now(),
      model jsonb not null, owner text not null default 'local',
      primary key (owner, project, commit_sha)
    )`;
  await q`alter table archmantic_models add column if not exists owner text`;
  await q`update archmantic_models set owner = 'local' where owner is null`;

  // Migrate older tables (PK on project+commit only) to the org-scoped PK.
  const pkCols = (await q`
    select a.attname from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
    where i.indrelid = 'archmantic_models'::regclass and i.indisprimary`) as { attname: string }[];
  if (!pkCols.some((r) => r.attname === "owner")) {
    await q`alter table archmantic_models alter column owner set not null`;
    await q`alter table archmantic_models drop constraint if exists archmantic_models_pkey`;
    await q`alter table archmantic_models add primary key (owner, project, commit_sha)`;
  }

  await q`
    create table if not exists archmantic_tokens (
      token_hash text primary key,
      owner text not null,
      label text,
      created_at timestamptz not null default now()
    )`;
}

/** Mint a token for an owner (org or user id). Returned once; only the hash is stored. */
export async function createToken(owner: string, label: string | null): Promise<string> {
  await ensureSchema();
  const token = "arch_" + randomBytes(24).toString("hex");
  await db()`insert into archmantic_tokens (token_hash, owner, label) values (${hashToken(token)}, ${owner}, ${label})`;
  return token;
}

/** Resolve a bearer token to its owner, or null if unknown. */
export async function ownerForToken(token: string): Promise<string | null> {
  if (!token) return null;
  try {
    const rows = (await db()`select owner from archmantic_tokens where token_hash = ${hashToken(token)}`) as {
      owner: string;
    }[];
    return rows[0]?.owner ?? null;
  } catch {
    return null;
  }
}

export async function pushModelApi(owner: string, model: Model, commit: string): Promise<void> {
  await ensureSchema();
  await db()`
    insert into archmantic_models (owner, project, commit_sha, generated_at, model)
    values (${owner}, ${model.project}, ${commit}, ${model.generatedAt ?? null}, ${JSON.stringify(model)})
    on conflict (owner, project, commit_sha)
    do update set model = excluded.model, generated_at = excluded.generated_at, pushed_at = now()`;
}

// ── Human-edited process diagrams (the edit-then-build moat, step 1) ──────────

export async function ensureProcessSchema(): Promise<void> {
  await db()`
    create table if not exists archmantic_process_edits (
      owner text not null,
      project text not null,
      bpmn_xml text not null,
      updated_at timestamptz not null default now(),
      primary key (owner, project)
    )`;
}

/** Persist a human-edited BPMN for (owner, project) — the org's authoritative process. */
export async function saveProcessEdit(owner: string, project: string, xml: string): Promise<void> {
  await ensureProcessSchema();
  await db()`
    insert into archmantic_process_edits (owner, project, bpmn_xml)
    values (${owner}, ${project}, ${xml})
    on conflict (owner, project) do update set bpmn_xml = excluded.bpmn_xml, updated_at = now()`;
}

/** The human-edited BPMN for (owner, project), or null if never edited. */
export async function getProcessEdit(owner: string, project: string): Promise<string | null> {
  try {
    const rows = (await db()`
      select bpmn_xml from archmantic_process_edits
      where owner = ${owner} and project = ${project}`) as { bpmn_xml: string }[];
    return rows[0]?.bpmn_xml ?? null;
  } catch {
    return null;
  }
}

export async function pullLatestForOwner(owner: string, project: string): Promise<Model | null> {
  try {
    const rows = (await db()`
      select model from archmantic_models
      where owner = ${owner} and project = ${project}
      order by pushed_at desc limit 1`) as { model: Model }[];
    return rows[0]?.model ?? null;
  } catch {
    return null;
  }
}
