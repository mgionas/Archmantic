// Tech-stack + used-libraries detection. Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectStack } from "../dist/analyze/stack.js";

function withRepo(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), "archmantic-stack-"));
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

test("curated stack + runtime libraries; dev tooling excluded", () => {
  withRepo(
    {
      "package.json": JSON.stringify({
        name: "app",
        dependencies: { next: "^15", axios: "^1", lodash: "^4" },
        devDependencies: { eslint: "^9", typescript: "^6" },
      }),
    },
    (dir) => {
      const t = detectStack(dir);
      const cat = (n) => t.find((x) => x.name === n)?.category;
      assert.equal(cat("Next.js"), "framework", "next → curated framework");
      assert.equal(cat("TypeScript"), "language", "typescript curated (from devDeps)");
      assert.equal(cat("axios"), "library", "unknown runtime dep → library");
      assert.equal(cat("lodash"), "library");
      assert.equal(t.find((x) => x.name === "eslint"), undefined, "devDependency not listed as a library");
      assert.equal(t.find((x) => x.name === "next"), undefined, "curated dep not duplicated as a raw library");
    },
  );
});

test("composer require → PHP libraries; php/ext + require-dev excluded", () => {
  withRepo(
    {
      "composer.json": JSON.stringify({
        require: { php: "^8.2", "laravel/framework": "^11", "guzzlehttp/guzzle": "^7", "ext-json": "*" },
        ["require-dev"]: { "barryvdh/laravel-debugbar": "^3" },
      }),
    },
    (dir) => {
      const t = detectStack(dir);
      const cat = (n) => t.find((x) => x.name === n)?.category;
      assert.equal(cat("Laravel"), "framework");
      assert.equal(cat("PHP"), "language", "php platform req → language");
      assert.equal(cat("guzzlehttp/guzzle"), "library");
      assert.equal(t.find((x) => x.name === "ext-json"), undefined, "platform ext not a library");
      assert.equal(t.find((x) => x.name === "barryvdh/laravel-debugbar"), undefined, "unknown require-dev not a library");
    },
  );
});
