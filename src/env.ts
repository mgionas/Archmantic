/**
 * Minimal, zero-dependency `.env` loader (BYOK). Reads `.env.local` then `.env`
 * into `process.env` without overriding variables already set in the real
 * environment. `.env.local` wins over `.env`; both lose to the actual shell env.
 *
 * Keeps the local CLI dependency-light — no `dotenv`. Secrets (ANTHROPIC_API_KEY,
 * DATABASE_URL) live in the gitignored `.env.local`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function loadEnv(root: string = process.cwd()): void {
  for (const name of [".env.local", ".env"]) {
    const path = join(root, name);
    if (!existsSync(path)) continue;
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}
