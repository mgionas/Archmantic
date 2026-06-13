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
import { hasApiToken, pushModel, pushModelApi } from "../cloud/index.js";
import {
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
  const server = new McpServer({ name: "archmantic", version: "0.1.0" });

  server.registerTool(
    "get_context",
    {
      title: "Get architecture context",
      description: "High-level architecture context: project, systems, external dependencies, counts, primary process.",
    },
    async () => text(getContext(model)),
  );

  server.registerTool(
    "list_components",
    {
      title: "List components",
      description: "List components (optionally filtered by a substring) with their responsibilities.",
      inputSchema: { filter: z.string().optional().describe("optional substring to filter by path/name") },
    },
    async ({ filter }) => text(listComponents(model, filter)),
  );

  server.registerTool(
    "get_component",
    {
      title: "Get component detail",
      description: "Responsibility, dependencies, dependents, and capabilities for one component (by name or path).",
      inputSchema: { name: z.string().describe("component name, basename, or repo path") },
    },
    async ({ name }) => text(getComponent(model, name)),
  );

  server.registerTool(
    "search_capabilities",
    {
      title: "Search capabilities",
      description: "Plain-English 'what can this system do?' capabilities matching a query (empty = all).",
      inputSchema: { query: z.string().default("").describe("search text; empty returns all capabilities") },
    },
    async ({ query }) => text(searchCapabilities(model, query)),
  );

  server.registerTool(
    "get_process",
    {
      title: "Get business process",
      description: "The primary business process (BPMN) as an ordered list of steps.",
    },
    async () => text(getProcess(model)),
  );

  server.registerTool(
    "get_sequence",
    {
      title: "Get sequence",
      description: "The primary call/dependency sequence (sequence diagram) as ordered messages.",
    },
    async () => text(getSequence(model)),
  );

  server.registerTool(
    "get_data_model",
    {
      title: "Get data model",
      description:
        "The persisted data model (DB entities/tables): each entity's fields with PK/FK/unique markers and its relations. Grounded in the schema file.",
    },
    async () => text(getDataModel(model)),
  );

  server.registerTool(
    "whats_related",
    {
      title: "What's related",
      description: "Immediate architectural neighbors (depends-on / used-by) of a component.",
      inputSchema: { name: z.string().describe("component name, basename, or repo path") },
    },
    async ({ name }) => text(whatsRelated(model, name)),
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

  process.stderr.write(
    `archmantic MCP server: serving "${model.project}" (${model.components.length} components, ${model.capabilities.length} capabilities) over stdio — read + sync tools\n`,
  );
  await server.connect(new StdioServerTransport());
}
