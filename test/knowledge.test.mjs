// Agent knowledge file (AGENTS.md) projection + managed block. Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeRepo } from "../dist/analyze/index.js";
import { knowledgeMarkdown, applyKnowledgeBlock, KNOWLEDGE_START, KNOWLEDGE_END } from "../dist/project/index.js";

const model = analyzeRepo(process.cwd());

test("knowledge markdown is grounded and concise", () => {
  const md = knowledgeMarkdown(model);
  assert.match(md, /## Architecture \(Archmantic\)/);
  assert.match(md, new RegExp(model.project.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(md, /capabilities/);
  // Concise: it's loaded every agent turn — keep it well under a huge dump.
  assert.ok(md.length < 12000, `knowledge file should stay compact, was ${md.length} chars`);
});

test("managed block inserts, then replaces in place, preserving surrounding notes", () => {
  const body1 = "BLOCK ONE";
  const created = applyKnowledgeBlock(null, body1);
  assert.ok(created.includes(KNOWLEDGE_START) && created.includes(KNOWLEDGE_END));
  assert.ok(created.includes("BLOCK ONE"));

  // Hand-authored content around the block must survive a regenerate.
  const withNotes = `# AGENTS\n\nMy hand-written rules.\n\n${KNOWLEDGE_START}\nold body\n${KNOWLEDGE_END}\n\nMore notes.\n`;
  const updated = applyKnowledgeBlock(withNotes, "NEW BODY");
  assert.ok(updated.includes("My hand-written rules."), "preamble preserved");
  assert.ok(updated.includes("More notes."), "trailing notes preserved");
  assert.ok(updated.includes("NEW BODY") && !updated.includes("old body"), "block replaced");
  // Exactly one managed block.
  assert.equal(updated.split(KNOWLEDGE_START).length - 1, 1);
});
