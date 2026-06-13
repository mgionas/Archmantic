/**
 * Drizzle ORM data-model detection.
 *
 * Parses `pgTable`/`mysqlTable`/`sqliteTable(...)` definitions in TS source into
 * DataEntity[]. Relations come from `.references(() => other.col)` foreign keys
 * (Drizzle has no inverse "list" field — the FK is the relationship), grounded to
 * `file:line`. Regex-based, dependency-light; the ERD derivation infers
 * cardinality from FK direction. See docs/ROADMAP.md.
 */
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { type DataEntity, type DataField } from "../ir/types.js";
import { STRUCTURAL_CONFIDENCE } from "./tier0.js";
import { findFiles } from "./fs-util.js";
import { balancedBlock, splitTopLevel } from "./parse-util.js";

/** Drizzle column-builder names that aren't real columns (table-level helpers). */
const NON_COLUMN = new Set(["primaryKey", "unique", "uniqueIndex", "index", "foreignKey", "check"]);

function parseFields(body: string, varToTable: Map<string, string>): DataField[] {
  const fields: DataField[] = [];
  for (const part of splitTopLevel(body)) {
    const m = /^\s*(\w+)\s*:\s*([\s\S]+)$/.exec(part);
    if (!m) continue;
    const name = m[1]!;
    const builder = m[2]!;
    const fn = /^(\w+)\s*\(/.exec(builder);
    if (!fn || NON_COLUMN.has(fn[1]!)) continue;
    const field: DataField = { name, type: fn[1]! };
    const isPk = /\.primaryKey\s*\(/.test(builder);
    if (isPk) field.isId = true;
    if (/\.unique\s*\(/.test(builder)) field.isUnique = true;
    if (!/\.notNull\s*\(/.test(builder) && !isPk) field.optional = true;
    const ref = /\.references\s*\(\s*\(\s*\)\s*=>\s*(\w+)\s*\./.exec(builder);
    if (ref) {
      const target = varToTable.get(ref[1]!);
      if (target) {
        field.isForeignKey = true;
        field.relationTo = `data:${target}`;
      }
    }
    fields.push(field);
  }
  return fields;
}

export function detectDrizzleModel(root: string): DataEntity[] {
  const sources = findFiles(root, (n) => /\.(ts|tsx|mts|cts)$/.test(n) && !n.endsWith(".d.ts"))
    .map((f) => ({ rel: relative(root, f).split("\\").join("/"), text: readFileSync(f, "utf8") }))
    .filter((s) => /\b(?:pg|mysql|sqlite)Table\s*\(/.test(s.text));
  if (!sources.length) return [];

  const tableRe = /export\s+const\s+(\w+)\s*=\s*(?:pg|mysql|sqlite)Table\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*\{/g;

  // Pass 1: var name → table name (so .references(() => users.id) resolves).
  interface Found {
    tableName: string;
    rel: string;
    bodyOpen: number;
    declLine: number;
    text: string;
  }
  const found: Found[] = [];
  const varToTable = new Map<string, string>();
  for (const s of sources) {
    tableRe.lastIndex = 0;
    let m;
    while ((m = tableRe.exec(s.text))) {
      varToTable.set(m[1]!, m[2]!);
      found.push({
        tableName: m[2]!,
        rel: s.rel,
        bodyOpen: tableRe.lastIndex - 1, // at the '{'
        declLine: s.text.slice(0, m.index).split("\n").length,
        text: s.text,
      });
    }
  }

  // Pass 2: parse each table body.
  return found.map((t) => ({
    id: `data:${t.tableName}`,
    name: t.tableName,
    fields: parseFields(balancedBlock(t.text, t.bodyOpen, "{", "}"), varToTable),
    provenance: [{ source: "code" as const, ref: `${t.rel}:${t.declLine}`, confidence: STRUCTURAL_CONFIDENCE }],
    confidence: STRUCTURAL_CONFIDENCE,
  }));
}
