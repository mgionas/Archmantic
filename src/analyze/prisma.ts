/**
 * Data-model detection (Prisma-first) — the "what does it persist?" layer.
 *
 * Parses `*.prisma` schema files into DataEntity[] (models → entities, fields →
 * columns, relations → edges), grounded with provenance to `schema.prisma:line`.
 * Declarative source → high confidence, no LLM needed. Drizzle/TypeORM/SQL come
 * later (see docs/ROADMAP.md); this is the first cut.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { type DataEntity, type DataField } from "../ir/types.js";
import { STRUCTURAL_CONFIDENCE } from "./tier0.js";

const IGNORE = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".vercel",
  ".archmantic",
]);

/** Find every `*.prisma` file under root (single- or multi-file schemas). */
function findPrismaFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (IGNORE.has(e.name) || e.name.startsWith(".")) continue;
        stack.push(full);
      } else if (e.isFile() && e.name.endsWith(".prisma")) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

interface PartialEntity {
  name: string;
  startLine: number;
  fields: DataField[];
  fkFields: Set<string>;
}

function finalize(cur: PartialEntity, rel: string): DataEntity {
  for (const f of cur.fields) if (cur.fkFields.has(f.name)) f.isForeignKey = true;
  return {
    id: `data:${cur.name}`,
    name: cur.name,
    fields: cur.fields,
    provenance: [{ source: "code", ref: `${rel}:${cur.startLine}`, confidence: STRUCTURAL_CONFIDENCE }],
    confidence: STRUCTURAL_CONFIDENCE,
  };
}

/** Parse the repo's Prisma schema(s) into data-model entities. Empty if none. */
export function detectDataModel(root: string): DataEntity[] {
  const files = findPrismaFiles(root);
  if (!files.length) return [];
  const sources = files.map((f) => ({
    rel: relative(root, f).split("\\").join("/"),
    text: readFileSync(f, "utf8"),
  }));

  // Pass 1: collect model names across all files (multi-file schemas cross-reference).
  const modelNames = new Set<string>();
  const declRe = /^\s*model\s+(\w+)\s*\{/;
  for (const s of sources) {
    for (const line of s.text.split("\n")) {
      const m = declRe.exec(line);
      if (m) modelNames.add(m[1]!);
    }
  }

  // Pass 2: parse each model block into fields.
  const fieldRe = /^\s*(\w+)\s+([A-Za-z_]\w*)(\[\])?(\?)?(.*)$/;
  const relFieldsRe = /@relation\([^)]*\bfields:\s*\[([^\]]*)\]/;
  const entities: DataEntity[] = [];

  for (const s of sources) {
    const lines = s.text.split("\n");
    let cur: PartialEntity | null = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.replace(/\/\/.*$/, ""); // strip line comments
      if (!cur) {
        const dm = declRe.exec(line);
        if (dm) cur = { name: dm[1]!, startLine: i + 1, fields: [], fkFields: new Set() };
        continue;
      }
      if (/^\s*\}/.test(line)) {
        entities.push(finalize(cur, s.rel));
        cur = null;
        continue;
      }
      if (/^\s*@@/.test(line)) continue; // block attributes (@@index, @@map…)
      const fm = fieldRe.exec(line);
      if (!fm) continue;
      const name = fm[1]!;
      const baseType = fm[2]!;
      const attrs = fm[5] ?? "";
      const field: DataField = { name, type: baseType };
      if (fm[3]) field.list = true;
      if (fm[4]) field.optional = true;
      if (/@id\b/.test(attrs)) field.isId = true;
      if (/@unique\b/.test(attrs)) field.isUnique = true;
      if (modelNames.has(baseType)) field.relationTo = `data:${baseType}`;
      const rf = relFieldsRe.exec(attrs);
      if (rf) for (const fk of (rf[1] ?? "").split(",").map((x) => x.trim()).filter(Boolean)) cur.fkFields.add(fk);
      cur.fields.push(field);
    }
    if (cur) entities.push(finalize(cur, s.rel)); // unclosed block at EOF (defensive)
  }

  return entities;
}
