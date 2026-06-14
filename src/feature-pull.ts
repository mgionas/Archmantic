/**
 * Pull hosted-editor feature edits from the cloud into `.archmantic/features/*.md`.
 * The hosted web app can't write your repo (it's remote), so it stores edits in
 * the cloud; this writes them down — repo files stay the source of truth. Used by
 * `archmantic feature pull` (on demand) and the MCP server (auto-pull on startup).
 * Last-write-wins: each pulled edit overwrites its feature file. Token-scoped.
 */
import { hasApiToken, pullFeatureEditsApi } from "./cloud/index.js";
import { writeFeatureEdit } from "./editor.js";

export interface PullResult {
  written: string[];
  reason?: string;
}

export async function pullFeatureEdits(root: string, project: string): Promise<PullResult> {
  if (!hasApiToken()) {
    return { written: [], reason: "no ARCHMANTIC_TOKEN — hosted feature edits are org-scoped (set the token to pull)" };
  }
  let edits;
  try {
    edits = await pullFeatureEditsApi(project);
  } catch (err) {
    return { written: [], reason: err instanceof Error ? err.message : String(err) };
  }
  const written = edits.map((e) => writeFeatureEdit(root, e));
  return { written };
}
