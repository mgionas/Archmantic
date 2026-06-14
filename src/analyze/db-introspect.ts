/**
 * Live database introspection for `db-check` (schema-drift). Reads the Laravel
 * `.env` DB_* config and queries the running database's schema. Opt-in only — this
 * is the one place Archmantic touches a live DB and reads credentials; nothing it
 * reads is persisted. Drivers are loaded on demand (mysql2 / pg are optional deps;
 * SQLite uses the built-in node:sqlite) so the core install stays dependency-light.
 */
import { resolve, isAbsolute } from "node:path";
import { type LiveSchema, type ColumnInfo } from "../drift/schema-drift.js";

export interface DbConfig {
  engine: "mysql" | "pg" | "sqlite";
  database: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  file?: string; // sqlite
}

/** Parse Laravel-style DB_* env into a connection config, or null if not determinable. */
export function readDbConfig(env: NodeJS.ProcessEnv, root: string): DbConfig | null {
  const conn = (env.DB_CONNECTION ?? "").toLowerCase();
  const engine: DbConfig["engine"] | null =
    /pg|postgres/.test(conn) ? "pg" : /sqlite/.test(conn) ? "sqlite" : /mysql|maria/.test(conn) ? "mysql" : null;
  if (!engine) return null;

  if (engine === "sqlite") {
    const raw = env.DB_DATABASE;
    if (!raw) return null;
    const file = isAbsolute(raw) ? raw : resolve(root, raw);
    return { engine, database: raw, file };
  }
  if (!env.DB_DATABASE) return null;
  return {
    engine,
    database: env.DB_DATABASE,
    host: env.DB_HOST || "127.0.0.1",
    port: Number(env.DB_PORT) || (engine === "pg" ? 5432 : 3306),
    user: env.DB_USERNAME || (engine === "pg" ? "postgres" : "root"),
    password: env.DB_PASSWORD || "",
  };
}

/** Dynamically load an optional DB driver, with an actionable error if it's missing. */
async function driver(name: string): Promise<Record<string, unknown>> {
  try {
    return (await import(name)) as Record<string, unknown>;
  } catch {
    if (name === "node:sqlite") throw new Error(`SQLite support needs Node 22.5+ (you're on ${process.version}).`);
    throw new Error(`the '${name}' driver isn't installed — run \`npm i ${name}\` (db-check needs it for this engine)`);
  }
}

function emptyRow(): Record<string, ColumnInfo> {
  return {};
}

/** Connect to the database and read its tables/columns into a LiveSchema. */
export async function introspectSchema(cfg: DbConfig): Promise<LiveSchema> {
  const tables: Record<string, Record<string, ColumnInfo>> = {};

  if (cfg.engine === "mysql") {
    const mysql = await driver("mysql2/promise");
    const conn = await (mysql.createConnection as (o: unknown) => Promise<{ query: (sql: string, p: unknown[]) => Promise<[unknown[], unknown]>; end: () => Promise<void> }>)({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
    });
    try {
      const [rows] = await conn.query(
        "SELECT TABLE_NAME t, COLUMN_NAME c, IS_NULLABLE n, DATA_TYPE d FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?",
        [cfg.database],
      );
      for (const r of rows as { t: string; c: string; n: string; d: string }[]) {
        (tables[r.t] ??= emptyRow())[r.c] = { nullable: r.n === "YES", type: r.d };
      }
    } finally {
      await conn.end();
    }
  } else if (cfg.engine === "pg") {
    const pg = await driver("pg");
    const Client = (pg.default as { Client: new (o: unknown) => { connect: () => Promise<void>; query: (s: string) => Promise<{ rows: unknown[] }>; end: () => Promise<void> } } | undefined)?.Client
      ?? (pg.Client as new (o: unknown) => { connect: () => Promise<void>; query: (s: string) => Promise<{ rows: unknown[] }>; end: () => Promise<void> });
    const client = new Client({ host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database });
    await client.connect();
    try {
      const res = await client.query(
        "SELECT table_name t, column_name c, is_nullable n, data_type d FROM information_schema.columns WHERE table_schema = 'public'",
      );
      for (const r of res.rows as { t: string; c: string; n: string; d: string }[]) {
        (tables[r.t] ??= emptyRow())[r.c] = { nullable: r.n === "YES", type: r.d };
      }
    } finally {
      await client.end();
    }
  } else {
    const sqlite = await driver("node:sqlite");
    const db = new (sqlite.DatabaseSync as new (p: string, o?: unknown) => { prepare: (s: string) => { all: (...a: unknown[]) => unknown[] }; close: () => void })(cfg.file!, { readOnly: true });
    try {
      const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
      for (const { name } of names) {
        const cols = db.prepare(`PRAGMA table_info('${name.replace(/'/g, "''")}')`).all() as { name: string; type: string; notnull: number }[];
        tables[name] = {};
        for (const col of cols) tables[name]![col.name] = { nullable: col.notnull === 0, type: col.type };
      }
    } finally {
      db.close();
    }
  }

  return { engine: cfg.engine, database: cfg.database, tables };
}
