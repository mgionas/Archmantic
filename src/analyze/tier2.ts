/**
 * Tier 2 — LLM semantic pass (SA-quality prose). Opt-in, BYOK, gated on
 * ANTHROPIC_API_KEY. See docs/ARCHITECTURE.md §7.
 *
 * Model tiering (locked): Haiku 4.5 for high-volume capability/component
 * summaries; Opus 4.8 for flow/process synthesis.
 *
 * Provenance invariant: the LLM only *refines prose and raises confidence* on
 * elements that the deterministic tiers already grounded with `file:line`. It
 * never invents new elements, edges, or capabilities — so every element stays
 * traceable to code. Each refined element gets a provenance entry recording
 * which model touched it.
 */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type ArchitectureModel } from "../ir/types.js";
import { hasAnthropicCredentials, NO_CREDENTIAL_HINT } from "../auth.js";

const HAIKU = "claude-haiku-4-5";
const OPUS = "claude-opus-4-8";

/** Confidence we assign once an element's prose is LLM-refined (high band). */
const LLM_CONFIDENCE = 0.85;

/** USD per 1M tokens, [input, output]. Cached 2026-05; for the est-cost report. */
const PRICING: Record<string, [number, number]> = {
  [HAIKU]: [1.0, 5.0],
  [OPUS]: [5.0, 25.0],
};

export interface Tier2Result {
  ran: boolean;
  reason?: string;
  capabilitiesRefined: number;
  componentsRefined: number;
  processRefined: boolean;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  estCostUsd: number;
}

const emptyResult = (reason: string): Tier2Result => ({
  ran: false,
  reason,
  capabilitiesRefined: 0,
  componentsRefined: 0,
  processRefined: false,
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
  estCostUsd: 0,
});

/** Read one source line (1-based) for the LLM's grounding context. */
function lineAt(root: string, ref: string, cache: Map<string, string[]>): string {
  const m = /^(.*):(\d+)$/.exec(ref);
  if (!m) return "";
  const [, rel, lineStr] = m;
  let lines = cache.get(rel!);
  if (!lines) {
    try {
      lines = readFileSync(join(root, rel!), "utf8").split("\n");
    } catch {
      lines = [];
    }
    cache.set(rel!, lines);
  }
  return (lines[Number(lineStr) - 1] ?? "").trim();
}

export async function tier2(root: string, model: ArchitectureModel): Promise<Tier2Result> {
  if (!hasAnthropicCredentials()) {
    return emptyResult(`${NO_CREDENTIAL_HINT} (Tier-2 LLM pass skipped)`);
  }

  // SDK resolves ANTHROPIC_API_KEY, else ANTHROPIC_AUTH_TOKEN (OAuth via ant login).
  const client = new Anthropic();
  const result: Tier2Result = { ...emptyResult(""), ran: true, reason: undefined };
  const fileCache = new Map<string, string[]>();

  /** One structured-output call; accumulates usage + cost. */
  async function callJSON<T>(
    modelId: string,
    system: string,
    user: string,
    schema: unknown,
    adaptiveThinking: boolean,
  ): Promise<T> {
    const params = {
      model: modelId,
      max_tokens: 8192,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: { type: "json_schema", schema } },
      ...(adaptiveThinking ? { thinking: { type: "adaptive" } } : {}),
    };
    const resp = await client.messages.create(params as never);
    const block = resp.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const usage = resp.usage;
    result.calls++;
    result.inputTokens += usage.input_tokens;
    result.outputTokens += usage.output_tokens;
    const [pin, pout] = PRICING[modelId] ?? [0, 0];
    result.estCostUsd += (usage.input_tokens * pin + usage.output_tokens * pout) / 1_000_000;
    return JSON.parse(block?.text ?? "{}") as T;
  }

  const llmProv = (modelId: string) => ({ source: "code" as const, ref: `llm:${modelId}`, confidence: LLM_CONFIDENCE });

  try {
    // --- Capabilities (Haiku, batched) ---
    if (model.capabilities.length) {
      const items = model.capabilities.map((c) => ({
        id: c.id,
        name: c.name,
        code: lineAt(root, c.provenance[0]?.ref ?? "", fileCache),
      }));
      const schema = {
        type: "object",
        additionalProperties: false,
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: { id: { type: "string" }, description: { type: "string" } },
              required: ["id", "description"],
            },
          },
        },
        required: ["items"],
      };
      const out = await callJSON<{ items: { id: string; description: string }[] }>(
        HAIKU,
        "You describe software capabilities in plain English for a non-engineer audience (PMs, architects). One sentence each, present tense, no code identifiers or file names. Describe what the system can DO, not how it's implemented.",
        "Write a capability description for each item (the `code` is the exported declaration):\n" +
          JSON.stringify(items),
        schema,
        false,
      );
      const byId = new Map(out.items.map((i) => [i.id, i.description]));
      for (const cap of model.capabilities) {
        const desc = byId.get(cap.id);
        if (!desc) continue;
        cap.description = desc;
        cap.confidence = Math.max(cap.confidence, LLM_CONFIDENCE);
        cap.provenance.push(llmProv(HAIKU));
        result.capabilitiesRefined++;
      }
    }

    // --- Component responsibilities (Haiku, batched) ---
    if (model.components.length) {
      const targetName = (id: string): string => {
        if (id.startsWith("comp:")) return id.slice("comp:".length).split("/").pop() ?? id;
        if (id.startsWith("sys:ext:")) return id.slice("sys:ext:".length);
        return id;
      };
      const items = model.components.map((c) => ({
        id: c.id,
        file: c.id.slice("comp:".length),
        dependsOn: model.relations.filter((r) => r.from === c.id).map((r) => targetName(r.to)),
      }));
      const schema = {
        type: "object",
        additionalProperties: false,
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: { id: { type: "string" }, responsibility: { type: "string" } },
              required: ["id", "responsibility"],
            },
          },
        },
        required: ["items"],
      };
      const out = await callJSON<{ items: { id: string; responsibility: string }[] }>(
        HAIKU,
        "You write one-line responsibility statements for code modules, in the style of a senior architect's component catalog. Infer the role from the file path and its dependencies. One concise clause, no trailing period needed.",
        "State each module's single responsibility:\n" + JSON.stringify(items),
        schema,
        false,
      );
      const byId = new Map(out.items.map((i) => [i.id, i.responsibility]));
      for (const comp of model.components) {
        const resp = byId.get(comp.id);
        if (!resp) continue;
        comp.responsibility = resp;
        comp.description = resp;
        comp.confidence = Math.max(comp.confidence, LLM_CONFIDENCE);
        comp.provenance.push(llmProv(HAIKU));
        result.componentsRefined++;
      }
    }

    // --- Process + flow synthesis (Opus 4.8) ---
    const process = model.processes[0];
    if (process && process.tasks.length) {
      const respById = new Map(model.components.map((c) => [c.id, c.responsibility ?? ""]));
      const steps = process.tasks.map((t) => {
        const compId = t.id.replace(/^task:/, "");
        return { id: t.id, module: t.name, responsibility: respById.get(compId) ?? "" };
      });
      const schema = {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          tasks: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: { id: { type: "string" }, name: { type: "string" } },
              required: ["id", "name"],
            },
          },
        },
        required: ["name", "description", "tasks"],
      };
      const out = await callJSON<{ name: string; description: string; tasks: { id: string; name: string }[] }>(
        OPUS,
        "You are a senior solution architect. Given the ordered modules a process orchestrates (with each module's responsibility), name the business process and rewrite each step as a concise business-meaningful action (verb phrase). Preserve the given order and the task ids exactly. Output strict JSON matching the schema.",
        "Synthesize the process from these ordered steps:\n" +
          JSON.stringify({ currentName: process.name, steps }),
        schema,
        true,
      );
      process.name = out.name || process.name;
      process.description = out.description || process.description;
      process.confidence = Math.max(process.confidence, LLM_CONFIDENCE);
      process.provenance.push(llmProv(OPUS));
      const taskNameById = new Map(out.tasks.map((t) => [t.id, t.name]));
      for (const task of process.tasks) {
        const nm = taskNameById.get(task.id);
        if (nm) {
          task.name = nm;
          task.provenance.push(llmProv(OPUS));
        }
      }
      // Mirror onto the matching flow's name/description if present.
      const flow = model.flows[0];
      if (flow) {
        flow.name = out.name ? `${out.name} sequence` : flow.name;
        flow.confidence = Math.max(flow.confidence, LLM_CONFIDENCE);
        flow.provenance.push(llmProv(OPUS));
      }
      result.processRefined = true;
    }
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return emptyResult(`Anthropic authentication failed — ${NO_CREDENTIAL_HINT}`);
    }
    const msg = err instanceof Error ? err.message : String(err);
    // Surface partial progress: keep ran=true, attach the error reason.
    result.reason = `Tier-2 stopped early: ${msg}`;
  }

  return result;
}
