/**
 * Token-savings benchmark (the *second* proof). For a set of realistic
 * architecture questions, compare the tokens an agent consumes answering via the
 * Archmantic MCP tools vs. reading the raw source files it would otherwise need.
 *
 * Graph questions (dependencies, dependents, "what can this do?") are the win:
 * the MCP answer is a few hundred tokens; the file-reading baseline is the whole
 * subtree. Default counting is an offline estimate (chars/4); `--exact` uses the
 * Anthropic token-counting endpoint (BYOK) for a precise number.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type ArchitectureModel } from "../ir/types.js";
import { walkSourceFiles } from "../analyze/walk.js";
import { getComponent, getContext, getProcess, searchCapabilities, whatsRelated } from "./queries.js";

export interface BenchTask {
  question: string;
  mcpTool: string;
  mcpAnswer: string;
  rawFiles: string[];
}

export interface BenchRow extends BenchTask {
  mcpTokens: number;
  rawTokens: number;
  savedPct: number;
}

export interface BenchReport {
  rows: BenchRow[];
  totalMcp: number;
  totalRaw: number;
  savedPct: number;
  mode: "estimate" | "exact";
}

export type TokenCounter = (text: string) => Promise<number>;

/** Offline heuristic — clearly labeled as an estimate (≈ chars/4). */
export const estimateCounter: TokenCounter = async (t) => Math.ceil(t.length / 4);

function buildTasks(root: string, model: ArchitectureModel): BenchTask[] {
  const src = walkSourceFiles(root).filter((f) => f.startsWith("src/"));
  return [
    {
      question: "What can this system do?",
      mcpTool: "search_capabilities",
      mcpAnswer: searchCapabilities(model, ""),
      rawFiles: src, // an agent would read the whole codebase to enumerate capabilities
    },
    {
      question: "What is the overall architecture context?",
      mcpTool: "get_context",
      mcpAnswer: getContext(model),
      rawFiles: ["package.json", ...src],
    },
    {
      question: "What does the analysis pipeline depend on and do?",
      mcpTool: "get_component(analyze)",
      mcpAnswer: getComponent(model, "analyze/index.ts"),
      rawFiles: [
        "src/analyze/index.ts",
        "src/analyze/walk.ts",
        "src/analyze/tier0.ts",
        "src/analyze/tier1.ts",
        "src/analyze/derive.ts",
      ],
    },
    {
      question: "What business process does the CLI implement?",
      mcpTool: "get_process",
      mcpAnswer: getProcess(model),
      rawFiles: ["src/cli.ts", "src/analyze/index.ts", "src/analyze/derive.ts"],
    },
    {
      question: "What depends on the IR types module?",
      mcpTool: "whats_related(ir/types)",
      mcpAnswer: whatsRelated(model, "ir/types.ts"),
      rawFiles: src, // finding dependents without the model means scanning everything
    },
  ];
}

function readFiles(root: string, files: string[]): string {
  const parts: string[] = [];
  for (const f of files) {
    const p = join(root, f);
    if (!existsSync(p)) continue;
    try {
      parts.push(readFileSync(p, "utf8"));
    } catch {
      /* skip */
    }
  }
  return parts.join("\n");
}

export async function runBenchmark(
  root: string,
  model: ArchitectureModel,
  count: TokenCounter,
  mode: "estimate" | "exact",
): Promise<BenchReport> {
  const tasks = buildTasks(root, model);
  const rows: BenchRow[] = [];
  for (const t of tasks) {
    const mcpTokens = await count(t.mcpAnswer);
    const rawTokens = await count(readFiles(root, t.rawFiles));
    const savedPct = rawTokens === 0 ? 0 : Math.round(((rawTokens - mcpTokens) / rawTokens) * 1000) / 10;
    rows.push({ ...t, mcpTokens, rawTokens, savedPct });
  }
  const totalMcp = rows.reduce((n, r) => n + r.mcpTokens, 0);
  const totalRaw = rows.reduce((n, r) => n + r.rawTokens, 0);
  const savedPct = totalRaw === 0 ? 0 : Math.round(((totalRaw - totalMcp) / totalRaw) * 1000) / 10;
  return { rows, totalMcp, totalRaw, savedPct, mode };
}

export function renderBench(report: BenchReport): string {
  const BOLD = "\x1b[1m";
  const DIM = "\x1b[2m";
  const GREEN = "\x1b[32m";
  const RESET = "\x1b[0m";
  const out: string[] = [];
  out.push(`${BOLD}Token-savings benchmark${RESET} ${DIM}(MCP query vs. raw file reads · ${report.mode} counts)${RESET}`);
  out.push("");
  for (const r of report.rows) {
    out.push(`${BOLD}${r.question}${RESET}`);
    out.push(
      `  via MCP ${DIM}(${r.mcpTool})${RESET}: ${r.mcpTokens} tok   ` +
        `via files ${DIM}(${r.rawFiles.length} files)${RESET}: ${r.rawTokens} tok   ` +
        `${GREEN}−${r.savedPct}%${RESET}`,
    );
  }
  out.push("");
  out.push(
    `${BOLD}Total:${RESET} ${report.totalMcp} tok via MCP vs ${report.totalRaw} tok via files  →  ` +
      `${GREEN}${BOLD}${report.savedPct}% fewer tokens${RESET}`,
  );
  if (report.mode === "estimate") {
    out.push(`${DIM}Estimated (≈ chars/4). Run \`archmantic bench --exact\` (needs ANTHROPIC_API_KEY) for precise counts.${RESET}`);
  }
  return out.join("\n");
}
