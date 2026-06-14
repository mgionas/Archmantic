// API surface detection (REST/tRPC/GraphQL). Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectEndpoints } from "../dist/analyze/endpoints.js";

function withRepo(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), "archmantic-ep-"));
  try {
    writeFileSync(join(dir, "package.json"), '{ "name": "ep" }');
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

const find = (eps, method, path) => eps.find((e) => e.method === method && e.path === path);

test("Next.js App Router routes → REST endpoints with dynamic segments", () => {
  withRepo(
    {
      "app/api/users/[id]/route.ts": "export async function GET(){} \nexport async function DELETE(){}",
      "app/api/health/route.ts": "export const GET = () => Response.json({});",
    },
    (dir) => {
      const eps = detectEndpoints(dir);
      assert.ok(find(eps, "GET", "/api/users/:id"), "dynamic [id] → :id");
      assert.ok(find(eps, "DELETE", "/api/users/:id"));
      assert.ok(find(eps, "GET", "/api/health"), "const export form detected");
      assert.ok(eps.every((e) => e.provenance[0].ref.includes(":")), "grounded to file:line");
    },
  );
});

test("Express-style calls detected; Map/Headers .get() ignored", () => {
  withRepo(
    {
      "src/server.ts": [
        'app.get("/widgets", h);',
        'router.post("/widgets", h);',
        'const m = new Map(); m.get("key");',
        'headers.get("authorization");',
      ].join("\n"),
    },
    (dir) => {
      const eps = detectEndpoints(dir);
      assert.ok(find(eps, "GET", "/widgets"));
      assert.ok(find(eps, "POST", "/widgets"));
      assert.ok(!eps.some((e) => e.path === "key" || e.path === "authorization"), "no false positives from .get()");
    },
  );
});

test("NestJS controller + method decorators → REST endpoints with joined paths", () => {
  withRepo(
    {
      "src/insights/insights.controller.ts": [
        "import { Controller, Get, Post, Patch } from '@nestjs/common';",
        "@Controller('insights')",
        "export class InsightsController {",
        "  @Post() create() {}",
        "  @Get(':id') one() {}",
        "  @Patch(':id/status') status() {}",
        "  @Get('vehicle/:vehicleId') byVehicle() {}",
        "}",
      ].join("\n"),
      "src/app.controller.ts": [
        "import { Controller, Get } from '@nestjs/common';",
        "@Controller()", // no prefix
        "export class AppController { @Get('health') health() {} }",
      ].join("\n"),
    },
    (dir) => {
      const eps = detectEndpoints(dir);
      assert.ok(find(eps, "POST", "/insights"), "@Post() → base path");
      assert.ok(find(eps, "GET", "/insights/:id"), "prefix + sub joined");
      assert.ok(find(eps, "PATCH", "/insights/:id/status"));
      assert.ok(find(eps, "GET", "/insights/vehicle/:vehicleId"));
      assert.ok(find(eps, "GET", "/health"), "empty @Controller() prefix");
      assert.ok(eps.every((e) => e.provenance[0].ref.includes(":")), "grounded to file:line");
    },
  );
});

test("tRPC procedures and GraphQL SDL fields", () => {
  withRepo(
    {
      "src/trpc.ts": "router({ getUser: publicProcedure.input(z.string()).query(()=>{}), addUser: t.procedure.mutation(()=>{}) })",
      "schema.graphql": "type Query {\n  users: [User!]!\n}\ntype Mutation {\n  createUser(name: String!): User\n}",
    },
    (dir) => {
      const eps = detectEndpoints(dir);
      const trpc = eps.filter((e) => e.protocol === "trpc");
      assert.ok(trpc.find((e) => e.path === "getUser" && e.method === "QUERY"));
      assert.ok(trpc.find((e) => e.path === "addUser" && e.method === "MUTATION"));
      const gql = eps.filter((e) => e.protocol === "graphql");
      assert.ok(gql.find((e) => e.path === "users" && e.method === "QUERY"));
      assert.ok(gql.find((e) => e.path === "createUser" && e.method === "MUTATION"));
    },
  );
});
