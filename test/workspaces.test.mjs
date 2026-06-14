// Monorepo workspace awareness — nested workspace members are analyzed as one
// model; independent nested packages stay excluded. Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analyzeRepo } from "../dist/analyze/index.js";
import { detectWorkspaces, packageOf } from "../dist/analyze/workspaces.js";

function withRepo(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), "archmantic-ws-"));
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

test("detectWorkspaces resolves npm/yarn globs to member dirs", () => {
  withRepo(
    {
      "package.json": JSON.stringify({ name: "root", workspaces: ["apps/*", "packages/db"] }),
      "apps/api/package.json": '{ "name": "api" }',
      "apps/web/package.json": '{ "name": "web" }',
      "packages/db/package.json": '{ "name": "db" }',
      "vendor/lib/package.json": '{ "name": "vendor" }', // not declared → not a member
    },
    (dir) => {
      assert.deepEqual(detectWorkspaces(dir), ["apps/api", "apps/web", "packages/db"]);
    },
  );
});

test("detectWorkspaces parses pnpm-workspace.yaml", () => {
  withRepo(
    {
      "package.json": '{ "name": "root" }',
      "pnpm-workspace.yaml": "packages:\n  - 'apps/*'\n  - '!apps/legacy'\n",
      "apps/api/package.json": '{ "name": "api" }',
      "apps/legacy/package.json": '{ "name": "legacy" }',
    },
    (dir) => {
      assert.deepEqual(detectWorkspaces(dir), ["apps/api", "apps/legacy"]); // negation not pruned, but member resolved
    },
  );
});

test("detectWorkspaces falls back to convention when nothing is declared", () => {
  withRepo(
    {
      "package.json": '{ "name": "root" }', // no workspaces field, no pnpm yaml
      "apps/admin/package.json": '{ "name": "admin" }',
      "apps/api/package.json": '{ "name": "api" }',
      "packages/ui/package.json": '{ "name": "ui" }',
      "docs/readme.md": "# docs", // not a package, ignored
    },
    (dir) => {
      assert.deepEqual(detectWorkspaces(dir), ["apps/admin", "apps/api", "packages/ui"]);
    },
  );
});

test("declared workspaces win over convention (no double-counting)", () => {
  withRepo(
    {
      "package.json": JSON.stringify({ name: "root", workspaces: ["apps/api"] }),
      "apps/api/package.json": '{ "name": "api" }',
      "apps/admin/package.json": '{ "name": "admin" }', // present but NOT declared → excluded
    },
    (dir) => {
      assert.deepEqual(detectWorkspaces(dir), ["apps/api"]);
    },
  );
});

test("packageOf picks the longest matching member prefix", () => {
  const members = ["apps/api", "packages/db"];
  assert.equal(packageOf("apps/api/src/route.ts", members), "apps/api");
  assert.equal(packageOf("packages/db/schema.prisma", members), "packages/db");
  assert.equal(packageOf("scripts/build.ts", members), undefined);
});

test("monorepo: API + components in a workspace member are analyzed and package-tagged", () => {
  withRepo(
    {
      "package.json": JSON.stringify({ name: "root", workspaces: ["apps/*"] }),
      "apps/api/package.json": JSON.stringify({ name: "api", dependencies: { express: "^4" } }),
      "apps/api/app/api/users/route.ts": "export async function GET(){}\nexport async function POST(){}",
      "apps/web/package.json": JSON.stringify({ name: "web", dependencies: { next: "^15" } }),
      "apps/web/app/page.tsx": "export default function Page(){ return <div/>; }",
    },
    (dir) => {
      const model = analyzeRepo(dir);
      assert.deepEqual(model.workspaces, ["apps/api", "apps/web"]);

      // Endpoints inside the nested workspace member are now found (the bug fix).
      const ep = model.endpoints.find((e) => e.method === "GET" && e.path === "/api/users");
      assert.ok(ep, "App Router route in apps/api is detected");
      assert.equal(ep.package, "apps/api", "endpoint tagged with owning package");

      // Components from both members are present and tagged.
      const apiComp = model.components.find((c) => c.package === "apps/api");
      const webComp = model.components.find((c) => c.package === "apps/web");
      assert.ok(apiComp, "apps/api component present + tagged");
      assert.ok(webComp, "apps/web component present + tagged");

      // Stack aggregates member deps (root package.json has none).
      const techNames = model.technologies.map((t) => t.name);
      assert.ok(techNames.includes("Express"), "express from apps/api");
      assert.ok(techNames.includes("Next.js"), "next from apps/web");
    },
  );
});

test("non-monorepo: independent nested package stays excluded (self-model stays clean)", () => {
  withRepo(
    {
      "package.json": '{ "name": "cli" }', // no workspaces field
      "src/cli.ts": "export const x = 1;",
      "web/package.json": '{ "name": "web" }',
      "web/app/api/secret/route.ts": "export async function GET(){}",
    },
    (dir) => {
      const model = analyzeRepo(dir);
      assert.equal(model.workspaces, undefined, "no workspaces recorded");
      assert.equal(
        model.endpoints.find((e) => e.path === "/api/secret"),
        undefined,
        "nested non-workspace package is NOT pulled in",
      );
      assert.equal(model.components.find((c) => c.id.includes("web/")), undefined);
    },
  );
});
