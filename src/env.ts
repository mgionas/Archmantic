/**
 * Minimal, zero-dependency `.env` loader (BYOK). Loads, in precedence order
 * (highest first): the real shell env → the project's `.env.local` → `.env` →
 * the user-level `~/.archmantic/.env`. A variable already set is never overridden,
 * so shell > project > user. The user-level file lets you set `ARCHMANTIC_TOKEN`
 * (+ `ARCHMANTIC_API_URL`) once so usage from *every* project — including ones the
 * plugin runs the MCP server in — reports to the cloud dashboard without a per-repo
 * `.env.local`.
 *
 * Keeps the local CLI dependency-light — no `dotenv`. Secrets (ANTHROPIC_API_KEY,
 * DATABASE_URL) live in the gitignored `.env.local`.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Read one env file into process.env, only setting vars that aren't already set. */
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

export function loadEnv(root: string = process.cwd()): void {
  // Project files first (they win over the user-level file), then the global fallback.
  loadEnvFile(join(root, ".env.local"));
  loadEnvFile(join(root, ".env"));
  loadEnvFile(join(homedir(), ".archmantic", ".env"));
}
