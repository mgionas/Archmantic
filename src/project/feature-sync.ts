/**
 * Feature intent compiler (Spec layer Phase 2b) — the edit→analyze→update loop.
 *
 * You edit a feature's description (e.g. "Home must have a vendors section");
 * `syncFeatures` reads the authored feature files + the repo's building blocks
 * (pages/routes/components) and asks Claude to compile that intent into a complete,
 * consistent feature set: fill each feature's shows/actions/dependsOn, and when a
 * description implies a *new* feature (Vendors), create it and wire the parent's
 * dependsOn. Results are written back as `.archmantic/features/<slug>.md` so the
 * spec stays git-versioned and human-owned. BYOK, gated on ANTHROPIC creds.
 */
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { type ArchitectureModel, type Feature } from "../ir/types.js";
import { hasAnthropicCredentials, NO_CREDENTIAL_HINT } from "../auth.js";
import { readFeatures, featureFileMarkdown, slugify, FEATURES_DIR } from "./features.js";

const OPUS = "claude-opus-4-8";
const HUMAN_CONFIDENCE = 0.9;

export interface SyncResult {
  ran: boolean;
  reason?: string;
  proposals: Feature[];
  applied: string[];
  inputTokens: number;
  outputTokens: number;
}

const OUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    features: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          shows: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: { text: { type: "string" }, source: { type: "string" } },
              required: ["text"],
            },
          },
          actions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: { name: { type: "string" }, description: { type: "string" } },
              required: ["name"],
            },
          },
          dependsOn: { type: "array", items: { type: "string" } },
          components: { type: "array", items: { type: "string" } },
        },
        required: ["name", "description"],
      },
    },
  },
  required: ["features"],
};

interface RawFeature {
  name: string;
  description: string;
  shows?: { text: string; source?: string }[];
  actions?: { name: string; description?: string }[];
  dependsOn?: string[];
  components?: string[];
}

const SYSTEM = [
  "You are a senior product architect compiling a product's FEATURE SPEC from human intent.",
  "You are given the authored features (their descriptions are the source of truth for intent) and",
  "the repo's building blocks (pages/routes/components with file paths).",
  "For EACH authored feature, return it with:",
  "- a tightened one-paragraph description (preserve the author's meaning),",
  "- `shows`: concrete things the user sees (note a source in parentheses when relevant, e.g. from admin/API),",
  "- `actions`: user actions (verb-led name + short description),",
  "- `dependsOn`: names of other features it relies on.",
  "When a description implies a feature that does not exist yet (e.g. 'a vendors section' ⇒ a Vendors feature),",
  "CREATE that feature too (with its own description/shows/actions) and add its name to the parent's dependsOn.",
  "Ground `components` ONLY to file paths present in the provided building blocks; never invent paths.",
  "Be tight and non-redundant. Do not invent unrelated features. Output strict JSON for the schema.",
].join("\n");

/** Compile authored feature intent into a complete feature set (optionally writing files). */
export async function syncFeatures(
  root: string,
  model: ArchitectureModel,
  opts: { write?: boolean; only?: string } = {},
): Promise<SyncResult> {
  const base: SyncResult = { ran: false, proposals: [], applied: [], inputTokens: 0, outputTokens: 0 };
  if (!hasAnthropicCredentials()) return { ...base, reason: `${NO_CREDENTIAL_HINT} (feature sync skipped)` };

  let authored = readFeatures(root);
  if (opts.only) {
    const slug = slugify(opts.only);
    authored = authored.filter((f) => f.id === `feature:${slug}` || f.name.toLowerCase() === opts.only!.toLowerCase());
  }
  if (!authored.length) {
    return {
      ...base,
      reason: opts.only
        ? `No authored feature "${opts.only}" in ${FEATURES_DIR}/. Run \`archmantic feature seed\` first, then edit it.`
        : `No authored features in ${FEATURES_DIR}/. Run \`archmantic feature seed\`, edit a description, then sync.`,
    };
  }

  // Building blocks: page/route/view components the LLM can ground `components` to.
  const blocks = model.components
    .filter((c) => ["page", "route", "view", "ui", "modal"].includes(c.role ?? ""))
    .map((c) => ({ path: c.id.replace(/^comp:/, ""), role: c.role, responsibility: c.responsibility }))
    .slice(0, 250);

  const payload = {
    goal: model.manifest?.goal ?? null,
    authoredFeatures: authored.map((f) => ({
      name: f.name,
      description: f.description ?? "",
      shows: f.shows ?? [],
      actions: f.actions ?? [],
      dependsOn: (f.dependsOn ?? []).map((id) => id.replace(/^feature:/, "")),
      components: (f.components ?? []).map((c) => c.replace(/^comp:/, "")),
    })),
    buildingBlocks: blocks,
  };

  const client = new Anthropic();
  let raw: { features: RawFeature[] };
  try {
    const resp = await client.messages.create({
      model: OPUS,
      max_tokens: 8192,
      system: SYSTEM,
      messages: [{ role: "user", content: "Compile this feature spec:\n" + JSON.stringify(payload) }],
      output_config: { format: { type: "json_schema", schema: OUT_SCHEMA } },
      thinking: { type: "adaptive" },
    } as never);
    const r = resp as Anthropic.Message;
    const block = r.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    base.inputTokens = r.usage.input_tokens;
    base.outputTokens = r.usage.output_tokens;
    raw = JSON.parse(block?.text ?? '{"features":[]}') as { features: RawFeature[] };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { ...base, reason: `Anthropic auth failed — ${NO_CREDENTIAL_HINT}` };
    return { ...base, reason: `feature sync failed: ${err instanceof Error ? err.message : String(err)}` };
  }

  const blockPaths = new Set(blocks.map((b) => b.path));
  const proposals: Feature[] = raw.features.map((rf) => {
    const slug = slugify(rf.name);
    const f: Feature = {
      id: `feature:${slug}`,
      name: rf.name,
      description: rf.description,
      provenance: [{ source: "human", ref: join(FEATURES_DIR, `${slug}.md`), confidence: HUMAN_CONFIDENCE }],
      confidence: HUMAN_CONFIDENCE,
    };
    if (rf.shows?.length) f.shows = rf.shows;
    if (rf.actions?.length) f.actions = rf.actions;
    if (rf.dependsOn?.length) f.dependsOn = [...new Set(rf.dependsOn.map((d) => `feature:${slugify(d)}`))];
    const comps = (rf.components ?? []).filter((p) => blockPaths.has(p)).map((p) => `comp:${p}`);
    if (comps.length) f.components = [...new Set(comps)];
    return f;
  });

  base.ran = true;
  base.proposals = proposals;

  if (opts.write && proposals.length) {
    const dir = join(root, FEATURES_DIR);
    mkdirSync(dir, { recursive: true });
    const nameById = new Map(proposals.map((f) => [f.id, f.name]));
    const nameOf = (id: string) => nameById.get(id) ?? id.replace(/^feature:/, "");
    for (const f of proposals) {
      const slug = f.id.replace(/^feature:/, "");
      writeFileSync(join(dir, `${slug}.md`), featureFileMarkdown(f, nameOf), "utf8");
      base.applied.push(slug);
    }
  }
  return base;
}
