import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// Single source of truth for secrets: load the repo-root .env.local (shared by
// the CLI and the web app) so DATABASE_URL + Clerk keys aren't duplicated.
// On Vercel there's no root .env.local — set the vars in Project Settings.
const rootEnv = join(here, "..", ".env.local");
if (existsSync(rootEnv)) {
  for (const raw of readFileSync(rootEnv, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: here,
};

export default nextConfig;
