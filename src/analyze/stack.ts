/**
 * Tier 0.5 — tech-stack detection ("what is this built with?").
 *
 * Classifies package.json dependencies into framework/UI/database/etc. via a
 * curated dictionary, grounded in package.json. Deterministic and cheap; the
 * Tier-2 LLM pass can later enrich unknown libraries.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Technology } from "../ir/types.js";
import { STRUCTURAL_CONFIDENCE } from "./tier0.js";
import { detectWorkspaces } from "./workspaces.js";

type Cat = "framework" | "ui" | "database" | "orm" | "auth" | "ai" | "testing" | "build" | "language" | "infra";

/** Curated package → {category, display name}. Scoped packages match on the scope/name. */
const KNOWN: Record<string, { cat: Cat; name: string }> = {
  next: { cat: "framework", name: "Next.js" },
  react: { cat: "ui", name: "React" },
  "react-dom": { cat: "ui", name: "React DOM" },
  vue: { cat: "framework", name: "Vue" },
  svelte: { cat: "framework", name: "Svelte" },
  "@angular/core": { cat: "framework", name: "Angular" },
  express: { cat: "framework", name: "Express" },
  fastify: { cat: "framework", name: "Fastify" },
  "@nestjs/core": { cat: "framework", name: "NestJS" },
  koa: { cat: "framework", name: "Koa" },
  "@hono/node-server": { cat: "framework", name: "Hono" },
  hono: { cat: "framework", name: "Hono" },
  tailwindcss: { cat: "ui", name: "Tailwind CSS" },
  "bpmn-js": { cat: "ui", name: "bpmn-js" },
  mermaid: { cat: "ui", name: "Mermaid" },
  "lucide-react": { cat: "ui", name: "lucide" },
  shadcn: { cat: "ui", name: "shadcn/ui" },
  "@base-ui/react": { cat: "ui", name: "Base UI" },
  pg: { cat: "database", name: "PostgreSQL (pg)" },
  "@neondatabase/serverless": { cat: "database", name: "Neon" },
  mysql2: { cat: "database", name: "MySQL" },
  mongodb: { cat: "database", name: "MongoDB" },
  redis: { cat: "database", name: "Redis" },
  prisma: { cat: "orm", name: "Prisma" },
  "@prisma/client": { cat: "orm", name: "Prisma" },
  "drizzle-orm": { cat: "orm", name: "Drizzle" },
  mongoose: { cat: "orm", name: "Mongoose" },
  typeorm: { cat: "orm", name: "TypeORM" },
  "@clerk/nextjs": { cat: "auth", name: "Clerk" },
  "next-auth": { cat: "auth", name: "Auth.js" },
  "@auth/core": { cat: "auth", name: "Auth.js" },
  passport: { cat: "auth", name: "Passport" },
  "@anthropic-ai/sdk": { cat: "ai", name: "Anthropic" },
  openai: { cat: "ai", name: "OpenAI" },
  "@modelcontextprotocol/sdk": { cat: "ai", name: "MCP SDK" },
  "ai": { cat: "ai", name: "Vercel AI SDK" },
  vitest: { cat: "testing", name: "Vitest" },
  jest: { cat: "testing", name: "Jest" },
  "@playwright/test": { cat: "testing", name: "Playwright" },
  mocha: { cat: "testing", name: "Mocha" },
  typescript: { cat: "language", name: "TypeScript" },
  vite: { cat: "build", name: "Vite" },
  webpack: { cat: "build", name: "webpack" },
  esbuild: { cat: "build", name: "esbuild" },
  turbo: { cat: "build", name: "Turborepo" },
  stripe: { cat: "infra", name: "Stripe" },
};

interface PkgJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/** Read & merge dependencies from a package.json, ignoring missing/malformed ones. */
function readDeps(file: string): Record<string, string> {
  try {
    const pkg = JSON.parse(readFileSync(file, "utf8")) as PkgJson;
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return {};
  }
}

/** Detect classified technologies from the repo's package.json (+ workspace members). */
export function detectStack(root: string): Technology[] {
  const pkgPath = join(root, "package.json");
  if (!existsSync(pkgPath)) return [];
  // Aggregate deps from the root and every declared workspace member — in a
  // monorepo the real stack lives in the member packages, not the thin root.
  const deps: Record<string, string> = { ...readDeps(pkgPath) };
  for (const m of detectWorkspaces(root)) Object.assign(deps, readDeps(join(root, m, "package.json")));
  const techs: Technology[] = [];
  const seen = new Set<string>();
  for (const dep of Object.keys(deps)) {
    const hit = KNOWN[dep];
    if (!hit || seen.has(hit.name)) continue;
    seen.add(hit.name);
    techs.push({
      id: `tech:${dep}`,
      name: hit.name,
      category: hit.cat,
      description: `${hit.cat} (${dep})`,
      provenance: [{ source: "repo", ref: "package.json", confidence: STRUCTURAL_CONFIDENCE }],
      confidence: STRUCTURAL_CONFIDENCE,
    });
  }
  return techs;
}
