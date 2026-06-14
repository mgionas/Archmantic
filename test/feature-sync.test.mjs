// Feature intent compiler — gating (the LLM path is BYOK/network, not unit-tested).
import { test } from "node:test";
import assert from "node:assert/strict";
import { syncFeatures } from "../dist/project/feature-sync.js";

test("gates gracefully without Anthropic credentials (never throws)", async () => {
  const k = process.env.ANTHROPIC_API_KEY;
  const t = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  try {
    const res = await syncFeatures(process.cwd(), { components: [], manifest: {} }, {});
    assert.equal(res.ran, false);
    assert.match(res.reason, /credential/i);
    assert.deepEqual(res.proposals, []);
  } finally {
    if (k) process.env.ANTHROPIC_API_KEY = k;
    if (t) process.env.ANTHROPIC_AUTH_TOKEN = t;
  }
});

test("with creds but no authored features, reports nothing to compile", async () => {
  const k = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "sk-test-not-used"; // creds present, but no features → returns before any API call
  try {
    // cwd has no .archmantic/features/ authored files → short-circuits before the LLM call.
    const res = await syncFeatures("/nonexistent-repo-xyz", { components: [], manifest: {} }, {});
    assert.equal(res.ran, false);
    assert.match(res.reason, /feature seed/i);
  } finally {
    if (k) process.env.ANTHROPIC_API_KEY = k;
    else delete process.env.ANTHROPIC_API_KEY;
  }
});
