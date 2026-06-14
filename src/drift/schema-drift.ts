/**
 * Schema-drift compare — migrations (the committed model) vs the live database.
 *
 * Migrations describe the *intended* schema; the running DB is what actually
 * exists, and they drift (hand-edits, un-run migrations, stale envs). This is the
 * pure diff over a `LiveSchema` (introspected by db-introspect.ts) and the
 * migration-derived entities. Presence-only by design (tables/columns in one side
 * but not the other) — type/nullability comparison is deferred to avoid the
 * false positives that come from Laravel defaults vs DB-specific types.
 */
import { type DataEntity } from "../ir/types.js";
import { DEFAULT_TABLES } from "../analyze/laravel-db.js";

export interface ColumnInfo {
  nullable: boolean;
  type: string;
}
export interface LiveSchema {
  engine: string;
  database: string;
  tables: Record<string, Record<string, ColumnInfo>>;
}
export interface TableDrift {
  table: string;
  dbOnly: string[]; // columns in the DB, not in migrations
  migrationOnly: string[]; // columns in migrations, not in the DB
}
export interface DriftReport {
  dbOnlyTables: string[];
  migrationOnlyTables: string[];
  drift: TableDrift[];
  matched: number; // tables present on both sides with no column drift
  inSync: boolean;
}

/** Diff a live schema against migration-derived entities (framework tables ignored). */
export function compareSchema(live: LiveSchema, entities: DataEntity[]): DriftReport {
  const liveTables = new Map(
    Object.entries(live.tables).filter(([t]) => !DEFAULT_TABLES.has(t)),
  );
  const migr = new Map(entities.map((e) => [e.name, e])); // entities already exclude framework tables

  const dbOnlyTables = [...liveTables.keys()].filter((t) => !migr.has(t)).sort();
  const migrationOnlyTables = [...migr.keys()].filter((t) => !liveTables.has(t)).sort();

  const drift: TableDrift[] = [];
  let matched = 0;
  for (const [t, e] of migr) {
    const liveCols = liveTables.get(t);
    if (!liveCols) continue; // migration-only table, already reported
    const migCols = new Set(e.fields.map((f) => f.name));
    const dbOnly = Object.keys(liveCols).filter((c) => !migCols.has(c)).sort();
    const migrationOnly = [...migCols].filter((c) => !(c in liveCols)).sort();
    if (dbOnly.length || migrationOnly.length) drift.push({ table: t, dbOnly, migrationOnly });
    else matched++;
  }

  const inSync = dbOnlyTables.length === 0 && migrationOnlyTables.length === 0 && drift.length === 0;
  return { dbOnlyTables, migrationOnlyTables, drift, matched, inSync };
}

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

/** Render a drift report for the terminal. */
export function renderDrift(report: DriftReport, live: LiveSchema, migrationTables: number): string {
  const out: string[] = [];
  out.push(`${BOLD}Schema drift${RESET} ${DIM}— migrations vs ${live.engine} database "${live.database}"${RESET}`);
  out.push(`  ${migrationTables} migration tables · ${Object.keys(live.tables).length} live tables`);
  if (report.inSync) {
    out.push(`\n${GREEN}✓ In sync${RESET} — every migration table matches the database.`);
    return out.join("\n");
  }
  if (report.dbOnlyTables.length) {
    out.push(`\n${YELLOW}In the DB, not in migrations${RESET} (${report.dbOnlyTables.length} tables):`);
    for (const t of report.dbOnlyTables) out.push(`  + ${t}`);
  }
  if (report.migrationOnlyTables.length) {
    out.push(`\n${YELLOW}In migrations, not in the DB${RESET} (${report.migrationOnlyTables.length} tables) — un-run migration?:`);
    for (const t of report.migrationOnlyTables) out.push(`  - ${t}`);
  }
  if (report.drift.length) {
    out.push(`\n${YELLOW}Column drift${RESET} (${report.drift.length} tables):`);
    for (const d of report.drift) {
      const bits = [
        ...d.dbOnly.map((c) => `+${c}`), // in DB only
        ...d.migrationOnly.map((c) => `-${c}`), // in migrations only
      ];
      out.push(`  ${d.table}: ${bits.join(", ")}  ${DIM}(+db / -migration)${RESET}`);
    }
  }
  out.push(`\n${DIM}${report.matched} tables in sync. (presence only — type/nullability not compared)${RESET}`);
  return out.join("\n");
}
