/**
 * The Curate layer — BYOK CLI runner. Archmantic is normally curated by the user's
 * own agent over MCP (the `curate` tool, their tokens). This is the "run it for me"
 * fallback for solo/test projects: it asks Claude (the user's ANTHROPIC key) to name
 * domains in product language, write one-line descriptions, and a positioning
 * narrative — then writes `.archmantic/curation.json` (merged into the model on
 * analyze). It only names/describes the grounded domains; it never invents structure.
 */
import Anthropic from "@anthropic-ai/sdk";
import { type ArchitectureModel } from "../ir/types.js";
import { hasAnthropicCredentials, NO_CREDENTIAL_HINT } from "../auth.js";
import { type Curation, writeCuration } from "./curation.js";

const OPUS = "claude-opus-4-8";
const PRICE_IN = 5 / 1_000_000;
const PRICE_OUT = 25 / 1_000_000;
const MAX_COMPONENTS_PER_DOMAIN = 14;

export interface CurateResult {
  ran: boolean;
  reason?: string;
  domains: number;
  inputTokens: number;
  outputTokens: number;
  estCostUsd: number;
}

const OUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    overview: { type: "string" },
    domains: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          slug: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["slug", "name", "description"],
      },
    },
  },
  required: ["overview", "domains"],
};

const SYSTEM = [
  "You are a senior software architect writing the human-onboarding layer for a codebase.",
  "You are given the project's detected domains (clusters of source files), its stack, external",
  "systems, and counts. For EACH domain, return:",
  "- `slug`: echo back the domain's slug EXACTLY as given (do not change it),",
  "- `name`: a concise product-language name (e.g. 'Payments', 'Analysis pipeline', 'MCP server'),",
  "- `description`: one line — what this domain does and why it exists.",
  "Also write `overview`: 1–2 short paragraphs — what this system IS and how it's SHAPED",
  "(its main parts and how they fit), the kind of thing you'd tell a new engineer on day one.",
  "Ground everything ONLY in the provided domains/stack — never invent components, domains, or",
  "capabilities. Be specific and concrete, not generic. Output strict JSON for the schema.",
].join("\n");

const domainSlug = (id: string) => id.replace(/^group:domain:/, "");

/** Build the compact grounding payload from the model's domains + context. */
function buildPayload(model: ArchitectureModel) {
  const roleOf = new Map(model.components.map((c) => [c.id, c.role ?? "module"]));
  const domains = model.groups
    .filter((g) => g.kind === "domain")
    .map((g) => ({
      slug: domainSlug(g.id),
      currentName: g.name,
      components: g.members
        .slice(0, MAX_COMPONENTS_PER_DOMAIN)
        .map((id) => ({ path: id.replace(/^comp:/, ""), role: roleOf.get(id) })),
      count: g.members.length,
    }));
  const stack = (model.technologies ?? [])
    .filter((t) => t.category !== "library")
    .map((t) => `${t.name} (${t.category})`);
  const externals = model.systems
    .filter((s) => s.kind === "external" && s.externalKind && s.externalKind !== "library" && s.externalKind !== "runtime")
    .map((s) => s.name);
  return {
    project: model.project,
    goal: model.manifest?.goal ?? null,
    stack,
    externalSystems: externals,
    counts: {
      components: model.components.length,
      endpoints: model.endpoints?.length ?? 0,
      entities: model.dataEntities?.length ?? 0,
      features: model.features?.length ?? 0,
    },
    domains,
  };
}

/** Run the AI curation pass (BYOK). Writes `.archmantic/curation.json` when `write`. */
export async function runCuration(
  root: string,
  model: ArchitectureModel,
  opts: { write?: boolean } = {},
): Promise<CurateResult> {
  const base: CurateResult = { ran: false, domains: 0, inputTokens: 0, outputTokens: 0, estCostUsd: 0 };
  if (!hasAnthropicCredentials()) return { ...base, reason: `${NO_CREDENTIAL_HINT} (curate skipped)` };
  const domainGroups = model.groups.filter((g) => g.kind === "domain");
  if (!domainGroups.length) return { ...base, reason: "No domains to curate — run `archmantic analyze` first." };

  const payload = buildPayload(model);
  const client = new Anthropic();
  let raw: { overview?: string; domains?: { slug: string; name?: string; description?: string }[] };
  try {
    const resp = await client.messages.create({
      model: OPUS,
      max_tokens: 8192,
      system: SYSTEM,
      messages: [{ role: "user", content: "Curate this architecture for humans:\n" + JSON.stringify(payload) }],
      output_config: { format: { type: "json_schema", schema: OUT_SCHEMA } },
      thinking: { type: "adaptive" },
    } as never);
    const r = resp as Anthropic.Message;
    const block = r.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    base.inputTokens = r.usage.input_tokens;
    base.outputTokens = r.usage.output_tokens;
    base.estCostUsd = r.usage.input_tokens * PRICE_IN + r.usage.output_tokens * PRICE_OUT;
    raw = JSON.parse(block?.text ?? "{}");
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { ...base, reason: `Anthropic auth failed — ${NO_CREDENTIAL_HINT}` };
    return { ...base, reason: `curate failed: ${err instanceof Error ? err.message : String(err)}` };
  }

  // Keep only domains the model actually has (never let the LLM invent a domain).
  const known = new Set(domainGroups.map((g) => domainSlug(g.id)));
  const curation: Curation = { overview: raw.overview, domains: {} };
  for (const d of raw.domains ?? []) {
    if (!d.slug || !known.has(d.slug)) continue;
    curation.domains![d.slug] = { name: d.name, description: d.description };
  }

  base.ran = true;
  base.domains = Object.keys(curation.domains!).length;
  if (opts.write) writeCuration(root, curation);
  return base;
}
