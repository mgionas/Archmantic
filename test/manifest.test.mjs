// Project manifest (the "project brain"). Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readManifest, detectAgents, applyManifest, scaffoldManifest } from "../dist/project/manifest.js";

function withRepo(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), "archmantic-man-"));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const parts = rel.split("/");
      if (parts.length > 1) mkdirSync(join(dir, ...parts.slice(0, -1)), { recursive: true });
      writeFileSync(join(dir, ...parts), content);
    }
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("reads .archmantic/project.json", () => {
  withRepo(
    { ".archmantic/project.json": JSON.stringify({ goal: "Do X", author: { name: "Ann" }, status: "active" }) },
    (dir) => {
      const m = readManifest(dir);
      assert.equal(m.goal, "Do X");
      assert.equal(m.author.name, "Ann");
    },
  );
});

test("auto-detects the agent team from .claude/agents/*", () => {
  withRepo(
    {
      ".claude/agents/core-engineer.md": "---\nname: core-engineer\ndescription: Builds the core.\n---\nbody",
      ".claude/agents/reviewer.md": "no frontmatter here",
    },
    (dir) => {
      const agents = detectAgents(dir);
      const core = agents.find((a) => a.name === "core-engineer");
      assert.ok(core, "name from frontmatter");
      assert.equal(core.role, "Builds the core.");
      assert.ok(agents.find((a) => a.name === "reviewer"), "falls back to filename when no frontmatter");
      assert.ok(core.file.endsWith(".claude/agents/core-engineer.md"));
    },
  );
});

test("applyManifest merges manifest and auto-seeds agents when absent", () => {
  withRepo(
    {
      ".archmantic/project.json": JSON.stringify({ goal: "G" }),
      ".claude/agents/a.md": "---\nname: a\ndescription: A.\n---",
    },
    (dir) => {
      const model = {};
      applyManifest(dir, model);
      assert.equal(model.manifest.goal, "G");
      assert.equal(model.manifest.agents.length, 1, "agents auto-seeded from .claude/agents");
      assert.equal(model.manifest.agents[0].name, "a");
    },
  );
});

test("no manifest + no agents → model.manifest stays undefined", () => {
  withRepo({ "src/x.ts": "export const x = 1;" }, (dir) => {
    const model = {};
    applyManifest(dir, model);
    assert.equal(model.manifest, undefined);
  });
});

test("scaffoldManifest creates project.json once", () => {
  withRepo({}, (dir) => {
    assert.equal(scaffoldManifest(dir, "proj"), true);
    assert.ok(existsSync(join(dir, ".archmantic", "project.json")));
    assert.equal(scaffoldManifest(dir, "proj"), false, "does not overwrite");
  });
});
