/**
 * MCP server (USP 7: the diagram you edit *is* the context your agent queries).
 * Exposes read tools over the committed IR so an agent (Claude Code, Cursor, …)
 * gets exactly the architectural slice it needs instead of reading whole files.
 *
 * stdio transport: protocol travels on stdout, so all human logging goes to
 * stderr. Built on the official @modelcontextprotocol/sdk.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { type ArchitectureModel, serializeModel } from "../ir/types.js";
import { analyzeRepo } from "../analyze/index.js";
import { diffModels, summarizeChange } from "../diff/index.js";
import {
  hasApiToken,
  pushModel,
  pushModelApi,
  recordUsage,
  recordUsageApi,
  type UsageEvent,
} from "../cloud/index.js";
import { UsageRecorder } from "./usage.js";
import {
  getApiSurface,
  getComponent,
  getContext,
  getDataModel,
  getProcess,
  getSequence,
  listComponents,
  searchCapabilities,
  whatsRelated,
} from "./queries.js";

const MODEL_PATH = join(".archmantic", "model.json");

function loadModel(root: string): ArchitectureModel {
  const file = join(root, MODEL_PATH);
  if (!existsSync(file)) {
    throw new Error(`No model at ${MODEL_PATH}. Run \`archmantic analyze\` first.`);
  }
  return JSON.parse(readFileSync(file, "utf8")) as ArchitectureModel;
}

function currentCommit(root: string): string {
  try {
    return execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "working-tree";
  }
}

/** Re-analyze the repo from disk, persist canonically, and return the fresh model. */
function reanalyze(root: string): ArchitectureModel {
  const model = { ...analyzeRepo(root), generatedAt: new Date().toISOString() };
  const dir = join(root, ".archmantic");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "model.json"), serializeModel(model), "utf8");
  return model;
}

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });

export async function startMcpServer(root: string): Promise<void> {
  // Mutable so `refresh`/`sync` update what the read tools serve.
  let model = loadModel(root);
  const server = new McpServer({ name: "archmantic", version: "1.0.1" });

  // Usage stats: record each read tool, best-effort flush to the cloud (API if a
  // token is set, else direct DB, else local-log only). Never breaks the agent.
  const flushUsage = async (events: UsageEvent[]): Promise<void> => {
    if (hasApiToken()) await recordUsageApi(events);
    else if (process.env.DATABASE_URL) await recordUsage(events);
    // no creds → local log only (still queryable via `archmantic usage`)
  };
  const usage = new UsageRecorder(root, () => model.project, flushUsage);
  usage.start();
  /** Record the read, then return it as an MCP text result. */
  const served = (tool: string, answer: string) => {
    usage.record(tool, answer, new Date().toISOString());
    return text(answer);
  };

  server.registerTool(
    "get_context",
    {
      title: "Get architecture context",
      description: "High-level architecture context: project, systems, external dependencies, counts, primary process.",
    },
    async () => served("get_context", getContext(model)),
  );

  server.registerTool(
    "list_components",
    {
      title: "List components",
      description: "List components (optionally filtered by a substring) with their responsibilities.",
      inputSchema: { filter: z.string().optional().describe("optional substring to filter by path/name") },
    },
    async ({ filter }) => served("list_components", listComponents(model, filter)),
  );

  server.registerTool(
    "get_component",
    {
      title: "Get component detail",
      description: "Responsibility, dependencies, dependents, and capabilities for one component (by name or path).",
      inputSchema: { name: z.string().describe("component name, basename, or repo path") },
    },
    async ({ name }) => served("get_component", getComponent(model, name)),
  );

  server.registerTool(
    "search_capabilities",
    {
      title: "Search capabilities",
      description: "Plain-English 'what can this system do?' capabilities matching a query (empty = all).",
      inputSchema: { query: z.string().default("").describe("search text; empty returns all capabilities") },
    },
    async ({ query }) => served("search_capabilities", searchCapabilities(model, query)),
  );

  server.registerTool(
    "get_process",
    {
      title: "Get business process",
      description: "The primary business process (BPMN) as an ordered list of steps.",
    },
    async () => served("get_process", getProcess(model)),
  );

  server.registerTool(
    "get_sequence",
    {
      title: "Get sequence",
      description: "The primary call/dependency sequence (sequence diagram) as ordered messages.",
    },
    async () => served("get_sequence", getSequence(model)),
  );

  server.registerTool(
    "get_data_model",
    {
      title: "Get data model",
      description:
        "The persisted data model (DB entities/tables): each entity's fields with PK/FK/unique markers and its relations. Grounded in the schema file.",
    },
    async () => served("get_data_model", getDataModel(model)),
  );

  server.registerTool(
    "get_api_surface",
    {
      title: "Get API surface",
      description:
        "The API contract: REST routes, tRPC procedures, and GraphQL operations with HTTP methods/paths, grouped by protocol. Grounded in code.",
    },
    async () => served("get_api_surface", getApiSurface(model)),
  );

  server.registerTool(
    "whats_related",
    {
      title: "What's related",
      description: "Immediate architectural neighbors (depends-on / used-by) of a component.",
      inputSchema: { name: z.string().describe("component name, basename, or repo path") },
    },
    async ({ name }) => served("whats_related", whatsRelated(model, name)),
  );

  // ── Write tools: the agent keeps the living model current ──────────────────

  server.registerTool(
    "refresh",
    {
      title: "Refresh the model",
      description:
        "Re-analyze the repository from disk and update the served model (and .archmantic/model.json). Call this after changing code so subsequent reads reflect reality.",
    },
    async () => {
      model = reanalyze(root);
      return text(`Refreshed — ${model.components.length} components, ${model.capabilities.length} capabilities.`);
    },
  );

  server.registerTool(
    "sync",
    {
      title: "Sync the model to the cloud",
      description:
        "Re-analyze the repo and push the updated architecture model to the team cloud (org-scoped via your token; direct via DATABASE_URL otherwise). Returns what changed. Call this after making architectural changes.",
    },
    async () => {
      const before = model;
      model = reanalyze(root);
      const diff = diffModels(before, model, "previous", "updated");
      const commit = currentCommit(root);
      const viaApi = hasApiToken();
      try {
        if (viaApi) await pushModelApi(model, commit);
        else await pushModel(model, commit);
      } catch (err) {
        return text(
          `Model refreshed locally, but cloud push failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      return text(
        `Synced "${model.project}" @ ${commit.slice(0, 7)} ${viaApi ? "(org-scoped API)" : "(direct)"}.\nChanges: ${summarizeChange(diff)}`,
      );
    },
  );

  // Flush buffered usage on shutdown so short sessions still report.
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      void usage.stop().finally(() => process.exit(0));
    });
  }
  process.on("beforeExit", () => void usage.stop());

  const summary = `serving "${model.project}" (${model.components.length} components, ${model.capabilities.length} capabilities)`;
  if (process.stdin.isTTY) {
    // A human ran this in a terminal (no MCP client piping stdin). Explain that
    // it's a long-running server, not a hung job, and how to wire it up.
    process.stderr.write(
      `\narchmantic MCP server — ${summary}\n\n` +
        `This is a long-running stdio server. It is NOT stuck — it is waiting for an\n` +
        `MCP client (your AI agent) to connect over stdin/stdout.\n\n` +
        `You don't run it by hand. Register it once and your agent starts it for you:\n` +
        `  • Claude Code:  claude mcp add archmantic -- npx archmantic mcp\n` +
        `  • Others:       add { "command": "npx", "args": ["archmantic","mcp"] } to mcpServers\n\n` +
        `Press Ctrl-C to stop.\n\n`,
    );
  } else {
    process.stderr.write(`archmantic MCP server: ${summary} over stdio — read + sync tools, usage stats on\n`);
  }
  await server.connect(new StdioServerTransport());
}
