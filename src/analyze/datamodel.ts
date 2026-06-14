/**
 * Data-model detection orchestrator — the "what does it persist?" layer.
 * Runs each source-specific parser (Prisma, Drizzle, SQL DDL) and merges the
 * results into one DataEntity[]. A repo typically uses one of these; on a name
 * clash the first source wins (Prisma → Drizzle → SQL).
 */
import { type DataEntity } from "../ir/types.js";
import { detectPrismaModel } from "./prisma.js";
import { detectDrizzleModel } from "./drizzle.js";
import { detectSqlModel } from "./sql.js";
import { detectLaravelMigrations } from "./laravel-db.js";

export function detectDataModel(root: string): DataEntity[] {
  const all = [
    ...detectPrismaModel(root),
    ...detectDrizzleModel(root),
    ...detectSqlModel(root),
    ...detectLaravelMigrations(root),
  ];
  const seen = new Set<string>();
  const out: DataEntity[] = [];
  for (const e of all) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}
