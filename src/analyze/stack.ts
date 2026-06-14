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

/** Curated Composer (PHP) package → {category, display name}. */
const KNOWN_PHP: Record<string, { cat: Cat; name: string }> = {
  php: { cat: "language", name: "PHP" },
  "laravel/framework": { cat: "framework", name: "Laravel" },
  "symfony/symfony": { cat: "framework", name: "Symfony" },
  "laravel/lumen-framework": { cat: "framework", name: "Lumen" },
  "inertiajs/inertia-laravel": { cat: "framework", name: "Inertia" },
  "livewire/livewire": { cat: "framework", name: "Livewire" },
  "filament/filament": { cat: "ui", name: "Filament" },
  "laravel/sanctum": { cat: "auth", name: "Sanctum" },
  "laravel/passport": { cat: "auth", name: "Passport" },
  "laravel/fortify": { cat: "auth", name: "Fortify" },
  "laravel/jetstream": { cat: "auth", name: "Jetstream" },
  "laravel/breeze": { cat: "auth", name: "Breeze" },
  "laravel/octane": { cat: "infra", name: "Octane" },
  "laravel/horizon": { cat: "infra", name: "Horizon" },
  "doctrine/orm": { cat: "orm", name: "Doctrine" },
  "phpunit/phpunit": { cat: "testing", name: "PHPUnit" },
  "pestphp/pest": { cat: "testing", name: "Pest" },
};

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

/** Read & merge `require` + `require-dev` from a composer.json, ignoring missing/malformed. */
function readComposer(file: string): Record<string, string> {
  try {
    const c = JSON.parse(readFileSync(file, "utf8")) as {
      require?: Record<string, string>;
      ["require-dev"]?: Record<string, string>;
    };
    return { ...c.require, ...c["require-dev"] };
  } catch {
    return {};
  }
}

/** Runtime dependency names from package.json (`dependencies` only — not dev tooling). */
function readRuntimeDeps(file: string): string[] {
  try {
    return Object.keys((JSON.parse(readFileSync(file, "utf8")) as PkgJson).dependencies ?? {});
  } catch {
    return [];
  }
}

/** Runtime PHP package names from composer.json `require` (excluding php/ext-* platform reqs). */
function readComposerRequire(file: string): string[] {
  try {
    const c = JSON.parse(readFileSync(file, "utf8")) as { require?: Record<string, string> };
    return Object.keys(c.require ?? {}).filter((d) => d !== "php" && !d.startsWith("ext-"));
  } catch {
    return [];
  }
}

/** Detect classified technologies from package.json (+ workspace members) and composer.json. */
export function detectStack(root: string): Technology[] {
  const techs: Technology[] = [];
  const seen = new Set<string>();
  const add = (dep: string, hit: { cat: Cat; name: string } | undefined, ref: string) => {
    if (!hit || seen.has(hit.name)) return;
    seen.add(hit.name);
    techs.push({
      id: `tech:${dep}`,
      name: hit.name,
      category: hit.cat,
      description: `${hit.cat} (${dep})`,
      provenance: [{ source: "repo", ref, confidence: STRUCTURAL_CONFIDENCE }],
      confidence: STRUCTURAL_CONFIDENCE,
    });
  };

  // JS/TS: aggregate deps from the root and every workspace member — in a
  // monorepo the real stack lives in the member packages, not the thin root.
  const pkgPath = join(root, "package.json");
  if (existsSync(pkgPath)) {
    const deps: Record<string, string> = { ...readDeps(pkgPath) };
    for (const m of detectWorkspaces(root)) Object.assign(deps, readDeps(join(root, m, "package.json")));
    for (const dep of Object.keys(deps)) add(dep, KNOWN[dep], "package.json");
  }

  // PHP: Laravel/Symfony/Inertia/etc. from composer.json (only known packages;
  // the `php` platform requirement maps to the PHP language).
  const composerPath = join(root, "composer.json");
  if (existsSync(composerPath)) {
    for (const dep of Object.keys(readComposer(composerPath))) add(dep, KNOWN_PHP[dep], "composer.json");
  }

  // Used libraries: every *runtime* dependency that isn't a curated tech, as
  // category "library" — so the model reflects the full dependency surface, not
  // just the highlighted stack. (devDependencies/build tooling are excluded.)
  const lib = (dep: string, ref: string) => {
    if (KNOWN[dep] || KNOWN_PHP[dep]) return; // already shown as a categorized tech
    const id = `tech:${dep}`;
    if (seen.has(id)) return;
    seen.add(id);
    techs.push({
      id,
      name: dep,
      category: "library",
      description: `library (${dep})`,
      provenance: [{ source: "repo", ref, confidence: STRUCTURAL_CONFIDENCE }],
      confidence: STRUCTURAL_CONFIDENCE,
    });
  };
  if (existsSync(pkgPath)) {
    const names = new Set(readRuntimeDeps(pkgPath));
    for (const m of detectWorkspaces(root)) for (const d of readRuntimeDeps(join(root, m, "package.json"))) names.add(d);
    for (const dep of names) lib(dep, "package.json");
  }
  if (existsSync(composerPath)) for (const dep of readComposerRequire(composerPath)) lib(dep, "composer.json");

  return techs;
}
