/**
 * Agent hand-off — the "build" of edit-then-build. Runs the Archmantic build
 * spec through Claude (Opus 4.8, BYOK) to produce a concrete implementation plan
 * a coding agent (e.g. Claude Code) can execute to realize the architecture.
 *
 * Read-only: it produces a plan, it does not edit the repo. Gated on an
 * Anthropic credential (API key or `ant auth login`), like the Tier-2 pass.
 */
import Anthropic from "@anthropic-ai/sdk";
import { hasAnthropicCredentials, NO_CREDENTIAL_HINT } from "./auth.js";

const OPUS = "claude-opus-4-8";
/** USD per 1M tokens [input, output] for Opus 4.8. */
const PRICING: [number, number] = [5.0, 25.0];

export interface HandoffResult {
  ran: boolean;
  reason?: string;
  plan?: string;
  inputTokens: number;
  outputTokens: number;
  estCostUsd: number;
}

const SYSTEM = `You are a senior software engineer receiving an Archmantic "build spec" — the intended architecture of a repository, derived from its code and grounded in file:line references (capabilities, components with responsibilities and dependencies, external systems, and a business process).

Produce a concrete, ordered implementation plan that a coding agent can execute to make the codebase realize this architecture. For each step: name the specific files/components to add or change, the dependencies involved, and why. Call out likely gaps between the spec and the current code, and a final verification step. Be actionable and concise. Output Markdown only — no preamble.`;

export async function runHandoff(specMarkdown: string, project: string): Promise<HandoffResult> {
  if (!hasAnthropicCredentials()) {
    return { ran: false, reason: `${NO_CREDENTIAL_HINT} (agent hand-off skipped)`, inputTokens: 0, outputTokens: 0, estCostUsd: 0 };
  }
  const client = new Anthropic();
  try {
    const resp = await client.messages.create({
      model: OPUS,
      max_tokens: 8192,
      system: SYSTEM,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: `Build spec for "${project}":\n\n${specMarkdown}` }],
    } as never);
    const plan = (resp.content as Anthropic.ContentBlock[])
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const u = resp.usage;
    return {
      ran: true,
      plan,
      inputTokens: u.input_tokens,
      outputTokens: u.output_tokens,
      estCostUsd: (u.input_tokens * PRICING[0] + u.output_tokens * PRICING[1]) / 1_000_000,
    };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { ran: false, reason: `Anthropic authentication failed — ${NO_CREDENTIAL_HINT}`, inputTokens: 0, outputTokens: 0, estCostUsd: 0 };
    }
    throw err;
  }
}
