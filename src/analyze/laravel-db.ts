/**
 * Laravel migrations → data model (the PHP side of the ERD).
 *
 * Parses `database/migrations/*.php` `Schema::create('table', function (Blueprint
 * $table) { ... })` blocks (and `Schema::table(...)` alters, merged in) into
 * DataEntity[]: each `$table->type('col')->modifiers()` becomes a field with
 * PK/unique/optional markers; foreign keys (`foreignId('user_id')->constrained()`,
 * `foreign('x')->references('id')->on('table')`) become relations. Regex +
 * brace-matching, dependency-light; grounded to file:line. Pairs with the Laravel
 * route detector as the two halves of a PHP app's contract.
 */
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { type DataEntity, type DataField } from "../ir/types.js";
import { STRUCTURAL_CONFIDENCE } from "./tier0.js";
import { findFiles, isTestFile } from "./fs-util.js";
import { balancedBlock } from "./parse-util.js";

const MIGRATION_FILE = /(^|\/)database\/migrations\/[^/]+\.php$/;

/** Laravel Blueprint column method → IR scalar type. */
const TYPE_MAP: Record<string, string> = {
  bigincrements: "Int", increments: "Int", id: "Int", integer: "Int", biginteger: "Int",
  unsignedbiginteger: "Int", unsignedinteger: "Int", tinyinteger: "Int", smallinteger: "Int",
  mediuminteger: "Int", unsignedtinyinteger: "Int", unsignedsmallinteger: "Int", year: "Int",
  decimal: "Decimal", unsigneddecimal: "Decimal", float: "Float", double: "Float",
  boolean: "Boolean",
  string: "String", char: "String", text: "String", tinytext: "String", mediumtext: "String",
  longtext: "String", ipaddress: "String", macaddress: "String", remembertoken: "String",
  uuid: "Uuid", ulid: "Uuid",
  json: "Json", jsonb: "Json",
  date: "DateTime", datetime: "DateTime", datetimetz: "DateTime", time: "DateTime",
  timetz: "DateTime", timestamp: "DateTime", timestamptz: "DateTime",
  binary: "Bytes", enum: "Enum", set: "Enum", geometry: "Geometry", point: "Geometry",
};

const idType = new Set(["id", "bigincrements", "increments"]);
const singular = (t: string) => t.replace(/ies$/, "y").replace(/s$/, "");

/** Laravel/framework scaffolding tables — infrastructure, not the app's domain model. */
export const DEFAULT_TABLES = new Set([
  "migrations",
  "password_reset_tokens",
  "password_resets",
  "failed_jobs",
  "personal_access_tokens",
  "sessions",
  "cache",
  "cache_locks",
  "jobs",
  "job_batches",
  "telescope_entries",
  "telescope_entries_tags",
  "telescope_monitoring",
]);

export function detectLaravelMigrations(root: string): DataEntity[] {
  const entities = new Map<string, DataEntity>();
  const fieldsOf = new Map<string, Map<string, DataField>>();

  const entity = (table: string, ref: string): Map<string, DataField> => {
    const id = `entity:${table}`;
    if (!entities.has(id)) {
      entities.set(id, {
        id,
        name: table,
        fields: [],
        provenance: [{ source: "code", ref, confidence: STRUCTURAL_CONFIDENCE }],
        confidence: STRUCTURAL_CONFIDENCE,
      });
      fieldsOf.set(id, new Map());
    }
    return fieldsOf.get(id)!;
  };

  const addField = (fields: Map<string, DataField>, f: DataField) => {
    if (f.name && !fields.has(f.name)) fields.set(f.name, f);
  };

  for (const abs of findFiles(root, (n) => n.endsWith(".php"))) {
    const rel = relative(root, abs).split("\\").join("/");
    if (!MIGRATION_FILE.test(rel) || isTestFile(rel)) continue;
    let text: string;
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      continue;
    }

    // Each Schema::create/table('name', function (...) { BODY }) block.
    const schemaRe = /Schema::(create|table)\s*\(\s*['"]([^'"]+)['"]/g;
    let s: RegExpExecArray | null;
    while ((s = schemaRe.exec(text))) {
      const table = s[2]!;
      if (DEFAULT_TABLES.has(table)) continue; // skip framework scaffolding
      const braceIdx = text.indexOf("{", s.index);
      if (braceIdx === -1) continue;
      const body = balancedBlock(text, braceIdx, "{", "}");
      const fields = entity(table, `${rel}:${text.slice(0, s.index).split("\n").length}`);
      parseBlueprint(body, table, fields, addField);
    }
  }

  // Resolve relations: a field's relationTo points at a present entity id when known.
  const present = new Set([...entities.keys()].map((id) => id.slice("entity:".length)));
  const out: DataEntity[] = [];
  for (const [id, e] of entities) {
    const fields = [...fieldsOf.get(id)!.values()];
    for (const f of fields) {
      if (f.relationTo && !present.has(f.relationTo.slice("entity:".length))) {
        // keep the FK scalar but drop the dangling relation pointer
        f.relationTo = undefined;
      }
    }
    out.push({ ...e, fields });
  }
  return out;
}

/** Parse a Blueprint body's `$table->...` chains into fields + FK relations. */
function parseBlueprint(
  body: string,
  table: string,
  fields: Map<string, DataField>,
  add: (f: Map<string, DataField>, x: DataField) => void,
): void {
  // Split into statements on `;` — Blueprint calls are one chain per statement.
  for (const raw of body.split(";")) {
    const stmt = raw.trim();
    if (!stmt.startsWith("$table->")) continue;

    const opts = (mod: string) => new RegExp(`->\\s*${mod}\\s*\\(`).test(stmt);
    const nullable = opts("nullable");
    const unique = opts("unique");

    // timestamps()/softDeletes()/rememberToken() helpers.
    if (/\$table->\s*timestamps(Tz)?\s*\(/.test(stmt)) {
      add(fields, dtField("created_at")); add(fields, dtField("updated_at"));
      continue;
    }
    if (/\$table->\s*softDeletes(Tz)?\s*\(/.test(stmt)) { add(fields, dtField("deleted_at", true)); continue; }
    if (/\$table->\s*rememberToken\s*\(/.test(stmt)) {
      add(fields, { name: "remember_token", type: "String", optional: true });
      continue;
    }
    // morphs('x') → x_id + x_type (nullableMorphs → optional).
    const morph = /\$table->\s*(nullable)?[Mm]orphs\s*\(\s*['"]([^'"]+)['"]/.exec(stmt);
    if (morph) {
      const opt = Boolean(morph[1]);
      add(fields, { name: `${morph[2]}_id`, type: "Int", optional: opt, isForeignKey: true });
      add(fields, { name: `${morph[2]}_type`, type: "String", optional: opt });
      continue;
    }

    // foreignId('user_id')->constrained('users'?) — FK + relation.
    const fId = /\$table->\s*foreignId\s*\(\s*['"]([^'"]+)['"]/.exec(stmt);
    if (fId) {
      const col = fId[1]!;
      const con = /->\s*constrained\s*\(\s*['"]([^'"]+)['"]/.exec(stmt);
      const target = con?.[1] ?? guessTable(col);
      add(fields, { name: col, type: "Int", optional: nullable, isForeignKey: true, relationTo: `entity:${target}` });
      continue;
    }
    // foreign('col')->references('id')->on('table')
    const fk = /\$table->\s*foreign\s*\(\s*['"]([^'"]+)['"]/.exec(stmt);
    if (fk) {
      const col = fk[1]!;
      const on = /->\s*on\s*\(\s*['"]([^'"]+)['"]/.exec(stmt);
      const existing = fields.get(col);
      if (existing) {
        existing.isForeignKey = true;
        if (on) existing.relationTo = `entity:${on[1]}`;
      } else {
        add(fields, { name: col, type: "Int", isForeignKey: true, relationTo: on ? `entity:${on[1]}` : undefined });
      }
      continue;
    }

    // Generic: $table->type('col', ...) — first string arg is the column name.
    const m = /\$table->\s*(\w+)\s*\(\s*(?:['"]([^'"]+)['"])?/.exec(stmt);
    if (!m) continue;
    const method = m[1]!.toLowerCase();
    const type = TYPE_MAP[method];
    if (!type) continue; // not a column declaration (index(), primary(), etc.)
    const name = m[2] ?? (idType.has(method) ? "id" : undefined);
    if (!name) continue;
    add(fields, {
      name,
      type,
      optional: nullable,
      isUnique: unique,
      isId: idType.has(method),
    });
  }
}

const dtField = (name: string, optional = false): DataField => ({ name, type: "DateTime", optional });

/** `user_id` → `users`, `category_id` → `categories` (naive pluralization). */
function guessTable(col: string): string {
  const base = singular(col.replace(/_id$/, ""));
  return base.endsWith("y") ? base.slice(0, -1) + "ies" : base + "s";
}
