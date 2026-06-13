/**
 * Materialize and analyze the repo *as of a git ref*, without touching the
 * working tree (no checkout/stash). Used by `archmantic diff <ref>` to compare a
 * branch/PR base against the current code at the architecture level.
 *
 * Strategy: `git archive <ref>` streams the committed tree into a temp dir,
 * which we analyze with the normal pipeline, then delete.
 */
import { execFileSync, execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ArchitectureModel } from "../ir/types.js";
import { analyzeRepo } from "../analyze/index.js";

/** Conservative allow-list so a ref can never inject into the shell pipe. */
const SAFE_REF = /^[\w./~^@-]+$/;

export class GitRefError extends Error {}

/** Resolve a ref to its commit sha, throwing a clear error if it doesn't exist. */
export function resolveRef(root: string, ref: string): string {
  if (!SAFE_REF.test(ref)) throw new GitRefError(`Unsafe git ref: "${ref}"`);
  try {
    return execFileSync("git", ["-C", root, "rev-parse", "--verify", "--quiet", `${ref}^{commit}`], {
      encoding: "utf8",
    }).trim();
  } catch {
    throw new GitRefError(`Unknown git ref: "${ref}" (no such commit/branch/tag).`);
  }
}

/** Analyze the repo tree at `ref` in isolation. Returns the derived model. */
export function analyzeAtRef(root: string, ref: string): ArchitectureModel {
  resolveRef(root, ref); // validates + ensures it exists
  const tmp = mkdtempSync(join(tmpdir(), "archmantic-"));
  try {
    // ref is validated against SAFE_REF; tmp comes from mkdtemp (no spaces).
    execSync(`git -C "${root}" archive --format=tar ${ref} | tar -x -C "${tmp}"`, { stdio: "ignore" });
    return analyzeRepo(tmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
