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
      model jsonb not null, owner text, primary key (project, commit_sha)
    )`;
  await q`alter table archmantic_models add column if not exists owner text`;
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
    insert into archmantic_models (project, commit_sha, generated_at, model, owner)
    values (${model.project}, ${commit}, ${model.generatedAt ?? null}, ${JSON.stringify(model)}, ${owner})
    on conflict (project, commit_sha)
    do update set model = excluded.model, generated_at = excluded.generated_at, owner = excluded.owner, pushed_at = now()`;
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
