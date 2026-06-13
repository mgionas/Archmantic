/**
 * SQL DDL data-model detection.
 *
 * Parses `CREATE TABLE` statements in `*.sql` files (migrations, schema dumps)
 * into DataEntity[]: columns with PK/unique/nullable, and relations from inline
 * or table-level `REFERENCES`/`FOREIGN KEY`. Grounded to `file:line`. Handles
 * Postgres/MySQL/SQLite dialects loosely. See docs/ROADMAP.md.
 */
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { type DataEntity, type DataField } from "../ir/types.js";
import { STRUCTURAL_CONFIDENCE } from "./tier0.js";
import { findFiles } from "./fs-util.js";
import { balancedBlock, splitTopLevel } from "./parse-util.js";

const unquote = (s: string) => s.trim().replace(/^["'`\[]+|["'`\]]+$/g, "");

const CONSTRAINT = /^(PRIMARY\s+KEY|FOREIGN\s+KEY|CONSTRAINT|UNIQUE|CHECK|KEY|INDEX)\b/i;

function parseColumns(body: string): DataField[] {
  const fields: DataField[] = [];
  const pk = new Set<string>();
  const uniq = new Set<string>();
  const fk = new Map<string, string>();

  for (const raw of splitTopLevel(body)) {
    const def = raw.trim();
    if (!def) continue;

    if (CONSTRAINT.test(def)) {
      const p = /PRIMARY\s+KEY\s*\(([^)]*)\)/i.exec(def);
      if (p) for (const c of p[1]!.split(",")) pk.add(unquote(c));
      const u = /UNIQUE\s*(?:KEY\s+\w+\s*)?\(([^)]*)\)/i.exec(def);
      if (u) for (const c of u[1]!.split(",")) uniq.add(unquote(c));
      const f = /FOREIGN\s+KEY\s*\(([^)]*)\)\s*REFERENCES\s+["'`]?(\w+)/i.exec(def);
      if (f) fk.set(unquote(f[1]!.split(",")[0]!), f[2]!);
      continue;
    }

    const cm = /^["'`\[]?(\w+)["'`\]]?\s+([A-Za-z]\w*(?:\s*\([^)]*\))?)/.exec(def);
    if (!cm) continue;
    const field: DataField = { name: cm[1]!, type: cm[2]!.replace(/\s+/g, "") };
    const isPk = /\bPRIMARY\s+KEY\b/i.test(def);
    if (isPk) field.isId = true;
    if (/\bUNIQUE\b/i.test(def)) field.isUnique = true;
    if (!/\bNOT\s+NULL\b/i.test(def) && !isPk) field.optional = true;
    const ref = /\bREFERENCES\s+["'`]?(\w+)/i.exec(def);
    if (ref) {
      field.isForeignKey = true;
      field.relationTo = `data:${ref[1]}`;
    }
    fields.push(field);
  }

  // Apply table-level constraints to the parsed columns.
  for (const f of fields) {
    if (pk.has(f.name)) {
      f.isId = true;
      delete f.optional;
    }
    if (uniq.has(f.name)) f.isUnique = true;
    const target = fk.get(f.name);
    if (target) {
      f.isForeignKey = true;
      f.relationTo = `data:${target}`;
    }
  }
  return fields;
}

export function detectSqlModel(root: string): DataEntity[] {
  const sources = findFiles(root, (n) => n.endsWith(".sql")).map((f) => ({
    rel: relative(root, f).split("\\").join("/"),
    text: readFileSync(f, "utf8"),
  }));
  const createRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?["'`\[]?([A-Za-z_]\w*)["'`\]]?\s*\(/gi;

  const entities: DataEntity[] = [];
  const seen = new Set<string>();
  for (const s of sources) {
    createRe.lastIndex = 0;
    let m;
    while ((m = createRe.exec(s.text))) {
      const name = m[1]!;
      if (seen.has(name)) continue; // first definition wins (e.g. across migrations)
      seen.add(name);
      const body = balancedBlock(s.text, createRe.lastIndex - 1, "(", ")");
      entities.push({
        id: `data:${name}`,
        name,
        fields: parseColumns(body),
        provenance: [
          {
            source: "code",
            ref: `${s.rel}:${s.text.slice(0, m.index).split("\n").length}`,
            confidence: STRUCTURAL_CONFIDENCE,
          },
        ],
        confidence: STRUCTURAL_CONFIDENCE,
      });
    }
  }
  return entities;
}
