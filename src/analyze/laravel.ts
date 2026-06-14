/**
 * Laravel route detection — the PHP side of the API contract.
 *
 * Parses `routes/*.php` for `Route::verb('path', ...)` declarations, nested
 * prefix groups (`Route::prefix('x')->group(...)` and
 * `Route::group(['prefix' => 'x'], ...)`), and `resource`/`apiResource`
 * shorthands. `routes/api.php` is served under `/api`. Regex + brace-matching,
 * dependency-light; grounded to `file:line`. Laravel `{id}`/`{id?}` params are
 * normalized to the `:id` form used by the other detectors.
 *
 * Known limits: custom route files wired with a prefix in a service provider
 * can't infer that prefix (only the conventional `/api` for `api.php` is added).
 */
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { type Endpoint } from "../ir/types.js";
import { STRUCTURAL_CONFIDENCE } from "./tier0.js";
import { findFiles, isTestFile } from "./fs-util.js";
import { balancedBlock } from "./parse-util.js";

const ROUTE_FILE = /(^|\/)routes\/[^/]+\.php$/;
const PHP_CONFIDENCE = STRUCTURAL_CONFIDENCE;

const lineAt = (text: string, idx: number) => text.slice(0, idx).split("\n").length;

/** Join a prefix and a route path into a clean "/a/b"; `{id}`/`{id?}` → `:id`. */
function joinPath(...parts: string[]): string {
  const segs = parts
    .flatMap((s) => s.split("/"))
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^\{\.{0,3}(\w+)\??\}$/, ":$1"));
  return "/" + segs.join("/");
}

interface Span {
  prefix: string;
  start: number; // index of the group body's opening `{`
  end: number; // index of its matching `}`
}

/** Locate every route-group body and the prefix it contributes. */
function groupSpans(text: string): Span[] {
  const spans: Span[] = [];
  const record = (prefix: string, braceIdx: number) => {
    if (braceIdx < 0) return;
    const inner = balancedBlock(text, braceIdx, "{", "}");
    spans.push({ prefix, start: braceIdx, end: braceIdx + 1 + inner.length });
  };

  // Form B: Route::prefix('x')[->chain]*->group(function (...) { ... }
  const chainRe = /Route::((?:\w+\s*\([^)]*\)\s*->\s*)*\w+\s*\([^)]*\))\s*->\s*group\s*\(\s*function\b[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = chainRe.exec(text))) {
    const pm = /prefix\(\s*['"]([^'"]*)['"]/.exec(m[1]!);
    record(pm?.[1] ?? "", text.indexOf("{", m.index + m[0].length - 1));
  }

  // Form A: Route::group(['prefix' => 'x', ...], function (...) { ... }
  const arrRe = /Route::group\s*\(\s*\[([^\]]*)\]\s*,\s*function\b[^{]*\{/g;
  while ((m = arrRe.exec(text))) {
    const pm = /['"]prefix['"]\s*=>\s*['"]([^'"]*)['"]/.exec(m[1]!);
    record(pm?.[1] ?? "", text.indexOf("{", m.index + m[0].length - 1));
  }

  return spans;
}

/** Effective prefix for a route at `idx`: all enclosing group prefixes, outermost first. */
function prefixAt(spans: Span[], idx: number, base: string): string {
  const enclosing = spans
    .filter((s) => s.start < idx && idx < s.end)
    .sort((a, b) => a.start - b.start)
    .map((s) => s.prefix);
  return joinPath(base, ...enclosing);
}

export function detectLaravelRoutes(root: string): Endpoint[] {
  const out: Endpoint[] = [];
  const seen = new Set<string>();
  const push = (method: string, path: string, ref: string) => {
    const id = `endpoint:rest:${method}:${path}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      name: `${method} ${path}`,
      method,
      path,
      protocol: "rest",
      provenance: [{ source: "code", ref, confidence: PHP_CONFIDENCE }],
      confidence: PHP_CONFIDENCE,
    });
  };

  for (const abs of findFiles(root, (n) => n.endsWith(".php"))) {
    const rel = relative(root, abs).split("\\").join("/");
    if (!ROUTE_FILE.test(rel) || isTestFile(rel)) continue;
    let text: string;
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    // Laravel serves routes/api.php under the "api" prefix by convention.
    const base = rel.endsWith("/api.php") || rel === "routes/api.php" ? "api" : "";
    const spans = groupSpans(text);
    const at = (idx: number, p: string) => joinPath(prefixAt(spans, idx, base), p);
    const ref = (idx: number) => `${rel}:${lineAt(text, idx)}`;

    // Route::get/post/put/patch/delete/options/any('path', ...)
    const verbRe = /Route::(get|post|put|patch|delete|options|any)\s*\(\s*['"]([^'"]*)['"]/gi;
    let r: RegExpExecArray | null;
    while ((r = verbRe.exec(text))) {
      const verb = r[1]!.toUpperCase();
      push(verb === "ANY" ? "ANY" : verb, at(r.index, r[2]!), ref(r.index));
    }

    // Route::match(['get','post'], 'path', ...)
    const matchRe = /Route::match\s*\(\s*\[([^\]]*)\]\s*,\s*['"]([^'"]*)['"]/gi;
    while ((r = matchRe.exec(text))) {
      const path = at(r.index, r[2]!);
      for (const v of r[1]!.split(",")) {
        const verb = v.replace(/['"\s]/g, "").toUpperCase();
        if (verb) push(verb, path, ref(r.index));
      }
    }

    // Route::resource / apiResource('name', Controller) — expand to RESTful routes.
    const resRe = /Route::(resource|apiResource)\s*\(\s*['"]([^'"]*)['"]/gi;
    while ((r = resRe.exec(text))) {
      const name = r[2]!;
      const col = at(r.index, name);
      const item = `${col}/:id`;
      push("GET", col, ref(r.index));
      push("POST", col, ref(r.index));
      push("GET", item, ref(r.index));
      push("PUT", item, ref(r.index));
      push("DELETE", item, ref(r.index));
      if (r[1]!.toLowerCase() === "resource") {
        push("GET", at(r.index, `${name}/create`), ref(r.index));
        push("GET", `${item}/edit`, ref(r.index));
      }
    }
  }

  return out;
}
