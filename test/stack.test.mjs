// Tech-stack + used-libraries detection. Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectStack, classifyExternal, isSystemExternalKind } from "../dist/analyze/stack.js";

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

test("technologies carry their declared version", () => {
  withRepo(
    { "package.json": JSON.stringify({ name: "app", dependencies: { next: "^15.1.0", axios: "~1.7.2" } }) },
    (dir) => {
      const t = detectStack(dir);
      assert.equal(t.find((x) => x.name === "Next.js")?.version, "^15.1.0", "curated tech keeps its version");
      assert.equal(t.find((x) => x.name === "axios")?.version, "~1.7.2", "library keeps its version");
    },
  );
});

test("classifyExternal: real systems vs libraries vs runtime", () => {
  // real external systems → drawn on the graphs
  assert.equal(classifyExternal("pg", false), "datastore");
  assert.equal(classifyExternal("@neondatabase/serverless", false), "datastore");
  assert.equal(classifyExternal("stripe", false), "saas");
  assert.equal(classifyExternal("@anthropic-ai/sdk", false), "saas");
  assert.equal(classifyExternal("@aws-sdk/client-s3", false), "infra");
  // linked libraries → demoted to the Technologies page, NOT the graph
  assert.equal(classifyExternal("lucide-react", false), "library");
  assert.equal(classifyExternal("clsx", false), "library");
  assert.equal(classifyExternal("@modelcontextprotocol/sdk", false), "library");
  // runtime / builtins → never drawn
  assert.equal(classifyExternal("node:fs", false), "runtime");
  assert.equal(classifyExternal("fs", true), "runtime");
});

test("isSystemExternalKind: only real systems are graph-worthy", () => {
  assert.equal(isSystemExternalKind("datastore"), true);
  assert.equal(isSystemExternalKind("saas"), true);
  assert.equal(isSystemExternalKind("infra"), true);
  assert.equal(isSystemExternalKind("service"), true);
  assert.equal(isSystemExternalKind("library"), false);
  assert.equal(isSystemExternalKind("runtime"), false);
  assert.equal(isSystemExternalKind(undefined), false);
});
