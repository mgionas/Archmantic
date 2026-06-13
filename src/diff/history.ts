/**
 * Architecture history — how the architecture changed commit by commit. Walks
 * the last N commits, reconstructs the IR at each (via `analyzeAtRef`, the same
 * non-destructive git-archive path M3 uses), and diffs consecutive versions.
 *
 * The first step toward the team "cloud knowledge" story: a shared, reviewable
 * record of how the system's shape evolves — works on any repo, no committed
 * model or hook required.
 */
import { execFileSync } from "node:child_process";
import { analyzeAtRef } from "./snapshot.js";
import { diffModels, type ModelDiff } from "./model-diff.js";

export interface CommitArchChange {
  sha: string;
  subject: string;
  diff: ModelDiff;
}

const short = (sha: string) => sha.slice(0, 7);

/** Architecture deltas for the last `n` commits (newest first). */
export function architectureLog(root: string, n: number): CommitArchChange[] {
  // Fetch n+1 commits so the oldest in the window still has a parent to diff against.
  const raw = execFileSync("git", ["-C", root, "log", "-n", String(n + 1), "--format=%H%x09%s"], {
    encoding: "utf8",
  });
  const commits = raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf("\t");
      return { sha: line.slice(0, tab), subject: line.slice(tab + 1) };
    })
    .reverse(); // oldest → newest

  if (commits.length < 2) return [];

  const models = commits.map((c) => analyzeAtRef(root, c.sha));
  const out: CommitArchChange[] = [];
  for (let i = 1; i < commits.length; i++) {
    out.push({
      sha: commits[i]!.sha,
      subject: commits[i]!.subject,
      diff: diffModels(models[i - 1]!, models[i]!, short(commits[i - 1]!.sha), short(commits[i]!.sha)),
    });
  }
  return out.reverse(); // newest first for display
}
