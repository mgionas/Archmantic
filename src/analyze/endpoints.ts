/**
 * API surface detection — the contract layer ("what can callers invoke?").
 *
 * Detects REST routes (Next.js App Router `route.ts`, Pages `pages/api`, and
 * Express/Fastify/Koa/Hono `app.get("/…")` calls), tRPC procedures, and GraphQL
 * `Query`/`Mutation`/`Subscription` fields (SDL files + inline `gql\`…\``).
 * Grounded to `file:line`. Regex/structure-based, dependency-light. Pairs with the
 * data-model ERD as the two halves of the contract. See docs/ROADMAP.md.
 */
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { type Endpoint } from "../ir/types.js";
import { STRUCTURAL_CONFIDENCE } from "./tier0.js";
import { walkSourceFiles } from "./walk.js";
import { findFiles } from "./fs-util.js";
import { balancedBlock } from "./parse-util.js";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
const TRPC_CONFIDENCE = 0.8;

const lineAt = (text: string, idx: number) => text.slice(0, idx).split("\n").length;

/** `[id]` → `:id`, `[...slug]`/`[[...slug]]` → `*`, route groups/parallel routes dropped. */
function dynamicSeg(s: string): string {
  if (/^\[\[?\.\.\..+\]\]?$/.test(s)) return "*";
  const m = /^\[(.+)\]$/.exec(s);
  return m ? ":" + m[1] : s;
}

/** Derive the route path of a Next.js App Router `route.*` file. */
function appRouterPath(rel: string): string | null {
  const parts = rel.split("/");
  const i = parts.lastIndexOf("app");
  if (i === -1) return null;
  const segs = parts
    .slice(i + 1, -1) // between `app/` and the `route.*` filename
    .filter((s) => !(s.startsWith("(") && s.endsWith(")"))) // route groups / interceptors
    .filter((s) => !s.startsWith("@")) // parallel-route slots
    .map(dynamicSeg);
  return "/" + segs.join("/");
}

/** Derive the route path of a Next.js Pages API file (`pages/api/...`). */
function pagesApiPath(rel: string): string | null {
  const parts = rel.split("/");
  const i = parts.lastIndexOf("pages");
  if (i === -1 || parts[i + 1] !== "api") return null;
  const segs = parts.slice(i + 1); // ['api', ...dirs, 'file.ts']
  const file = segs.pop()!.replace(/\.(tsx?|jsx?|mjs|cjs)$/, "");
  if (file !== "index") segs.push(file);
  return "/" + segs.map(dynamicSeg).join("/");
}

/** Index of an exported HTTP-method handler (function/const/named re-export), or -1. */
function methodMatch(text: string, method: string): number {
  const re = new RegExp(
    `export\\s+(?:async\\s+)?function\\s+${method}\\b` +
      `|export\\s+(?:const|let|var)\\s+${method}\\s*[:=]` +
      `|export\\s*\\{[^}]*\\b${method}\\b[^}]*\\}`,
  );
  return text.search(re);
}

/** Parse GraphQL SDL for Query/Mutation/Subscription fields. Lines are 1-based within `text`. */
function parseSdl(text: string): { method: string; path: string; line: number }[] {
  const out: { method: string; path: string; line: number }[] = [];
  const typeRe = /\btype\s+(Query|Mutation|Subscription)\b[^{]*\{/g;
  let m;
  while ((m = typeRe.exec(text))) {
    const kind = m[1]!.toUpperCase();
    const openIdx = text.indexOf("{", m.index);
    if (openIdx === -1) continue;
    const body = balancedBlock(text, openIdx, "{", "}");
    const bodyStartLine = lineAt(text, openIdx);
    body.split("\n").forEach((raw, i) => {
      const line = raw.replace(/#.*$/, "").trim();
      const fm = /^(\w+)\s*[(:]/.exec(line);
      if (fm) out.push({ method: kind, path: fm[1]!, line: bodyStartLine + i });
    });
  }
  return out;
}

export function detectEndpoints(root: string): Endpoint[] {
  const out: Endpoint[] = [];
  const seen = new Set<string>();
  const push = (protocol: Endpoint["protocol"], method: string, path: string, ref: string, conf = STRUCTURAL_CONFIDENCE) => {
    const id = `endpoint:${protocol}:${method}:${path}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      name: `${method} ${path}`,
      method,
      path,
      protocol,
      provenance: [{ source: "code", ref, confidence: conf }],
      confidence: conf,
    });
  };

  const restCall = /\b[\w$]+\.(get|post|put|patch|delete|options|head|all)\s*\(\s*[`'"]([^`'"]+)[`'"]/gi;
  const trpcRe = /(\w+)\s*:\s*[\w.]*[Pp]rocedure[\s\S]{0,400}?\.(query|mutation|subscription)\s*\(/g;
  const gqlRe = /(?:gql|graphql)\s*`([\s\S]*?)`/g;

  for (const rel of walkSourceFiles(root)) {
    let text: string;
    try {
      text = readFileSync(join(root, rel), "utf8");
    } catch {
      continue;
    }
    const base = rel.split("/").pop()!;

    // Next.js App Router route handlers.
    if (/^route\.(tsx?|jsx?|mjs|cjs)$/.test(base)) {
      const p = appRouterPath(rel);
      if (p)
        for (const method of HTTP_METHODS) {
          const idx = methodMatch(text, method);
          if (idx >= 0) push("rest", method, p, `${rel}:${lineAt(text, idx)}`);
        }
    }

    // Next.js Pages API.
    const pa = pagesApiPath(rel);
    if (pa) push("rest", "ANY", pa, `${rel}:1`);

    // Express / Fastify / Koa / Hono method calls (require a leading-slash path to
    // avoid Map/Headers/`.get("x")` false positives).
    restCall.lastIndex = 0;
    let rm: RegExpExecArray | null;
    while ((rm = restCall.exec(text))) {
      const path = rm[2]!;
      if (!path.startsWith("/")) continue;
      const verb = rm[1]!.toUpperCase();
      push("rest", verb === "ALL" ? "ANY" : verb, path, `${rel}:${lineAt(text, rm.index)}`);
    }

    // tRPC procedures (best-effort).
    trpcRe.lastIndex = 0;
    let tm: RegExpExecArray | null;
    while ((tm = trpcRe.exec(text))) {
      push("trpc", tm[2]!.toUpperCase(), tm[1]!, `${rel}:${lineAt(text, tm.index)}`, TRPC_CONFIDENCE);
    }

    // Inline GraphQL SDL.
    gqlRe.lastIndex = 0;
    let gm: RegExpExecArray | null;
    while ((gm = gqlRe.exec(text))) {
      const startLine = lineAt(text, gm.index) - 1;
      for (const f of parseSdl(gm[1]!)) push("graphql", f.method, f.path, `${rel}:${startLine + f.line}`);
    }
  }

  // GraphQL SDL files.
  for (const abs of findFiles(root, (n) => n.endsWith(".graphql") || n.endsWith(".gql"))) {
    let text: string;
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const rel = relative(root, abs).split("\\").join("/");
    for (const f of parseSdl(text)) push("graphql", f.method, f.path, `${rel}:${f.line}`);
  }

  return out;
}
