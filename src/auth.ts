/**
 * Anthropic credential resolution (BYOK). Two ways to authenticate the Tier-2
 * LLM pass and `bench --exact`:
 *   1. An API key / auth token in the environment or .env.local
 *      (ANTHROPIC_API_KEY, or ANTHROPIC_AUTH_TOKEN for OAuth).
 *   2. `ant auth login` — the Anthropic CLI stores an OAuth profile; we pull a
 *      short-lived token from it via `ant auth print-credentials --env`.
 *
 * The SDK already resolves these on its own in most cases; this just makes the
 * CLI-login path explicit and lets us gate gracefully (skip with a clear note)
 * when no credential is available — without ever making a failed API call.
 */
import { execFileSync } from "node:child_process";

/**
 * Best-effort: if no key/token is in the env, try to hydrate one from an
 * `ant auth login` session. No-op if `ant` isn't installed or isn't logged in.
 * Never overrides an existing credential (and never sets both key + token,
 * which the API rejects).
 */
export function ensureAnthropicAuth(): void {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return;
  let out: string;
  try {
    out = execFileSync("ant", ["auth", "print-credentials", "--env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return; // ant not installed, or not logged in
  }
  for (const raw of out.split("\n")) {
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

/** Whether any Anthropic credential is available (after attempting CLI login). */
export function hasAnthropicCredentials(): boolean {
  ensureAnthropicAuth();
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/** Shared, user-facing message for when no credential is found. */
export const NO_CREDENTIAL_HINT =
  "no Anthropic credential — set ANTHROPIC_API_KEY in .env.local, or run `ant auth login` (CLI OAuth).";
