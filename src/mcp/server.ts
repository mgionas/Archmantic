/**
 * MCP server (USP 7: the diagram you edit *is* the context your agent queries).
 * Exposes read tools over the committed IR so an agent (Claude Code, Cursor, …)
 * gets exactly the architectural slice it needs instead of reading whole files.
 *
 * stdio transport: protocol travels on stdout, so all human logging goes to
 * stderr. Built on the official @modelcontextprotocol/sdk.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { type ArchitectureModel } from "../ir/types.js";
import {
  getComponent,
  getContext,
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

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });

export async function startMcpServer(root: string): Promise<void> {
  const model = loadModel(root);
  const server = new McpServer({ name: "archmantic", version: "0.0.1" });

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
    "whats_related",
    {
      title: "What's related",
      description: "Immediate architectural neighbors (depends-on / used-by) of a component.",
      inputSchema: { name: z.string().describe("component name, basename, or repo path") },
    },
    async ({ name }) => text(whatsRelated(model, name)),
  );

  process.stderr.write(
    `archmantic MCP server: serving "${model.project}" (${model.components.length} components, ${model.capabilities.length} capabilities) over stdio\n`,
  );
  await server.connect(new StdioServerTransport());
}
