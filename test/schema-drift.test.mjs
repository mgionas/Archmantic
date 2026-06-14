// Schema-drift (db-check): pure compare, config parsing, + a live SQLite round-trip.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { compareSchema } from "../dist/drift/schema-drift.js";
import { readDbConfig, introspectSchema } from "../dist/analyze/db-introspect.js";

const entity = (name, cols) => ({
  id: `entity:${name}`,
  name,
  fields: cols.map((c) => ({ name: c, type: "String" })),
  provenance: [{ source: "code", ref: `${name}.php:1`, confidence: 0.95 }],
  confidence: 0.95,
});

test("compareSchema flags table + column drift, ignores framework tables", () => {
  const live = {
    engine: "sqlite",
    database: "x",
    tables: {
      users: { id: { nullable: false, type: "int" }, email: { nullable: false, type: "text" }, last_login: { nullable: true, type: "text" } },
      audit_logs: { id: { nullable: false, type: "int" } }, // in DB, not in migrations
      jobs: { id: { nullable: false, type: "int" } }, // framework → ignored both sides
    },
  };
  const entities = [
    entity("users", ["id", "email", "nickname"]), // nickname in migration, not DB; last_login in DB, not migration
    entity("promo_codes", ["id"]), // in migrations, not DB
  ];
  const r = compareSchema(live, entities);
  assert.deepEqual(r.dbOnlyTables, ["audit_logs"], "jobs filtered as framework");
  assert.deepEqual(r.migrationOnlyTables, ["promo_codes"]);
  const users = r.drift.find((d) => d.table === "users");
  assert.deepEqual(users.dbOnly, ["last_login"]);
  assert.deepEqual(users.migrationOnly, ["nickname"]);
  assert.equal(r.inSync, false);
});

test("compareSchema reports in-sync when everything matches", () => {
  const live = { engine: "sqlite", database: "x", tables: { users: { id: { nullable: false, type: "int" } } } };
  const r = compareSchema(live, [entity("users", ["id"])]);
  assert.equal(r.inSync, true);
  assert.equal(r.matched, 1);
});

test("readDbConfig parses mysql / pgsql / sqlite", () => {
  const my = readDbConfig({ DB_CONNECTION: "mysql", DB_DATABASE: "app", DB_HOST: "db", DB_PORT: "3307" }, "/r");
  assert.equal(my.engine, "mysql");
  assert.equal(my.port, 3307);
  const pg = readDbConfig({ DB_CONNECTION: "pgsql", DB_DATABASE: "app" }, "/r");
  assert.equal(pg.engine, "pg");
  assert.equal(pg.port, 5432);
  const lite = readDbConfig({ DB_CONNECTION: "sqlite", DB_DATABASE: "database/db.sqlite" }, "/repo");
  assert.equal(lite.engine, "sqlite");
  assert.equal(lite.file, "/repo/database/db.sqlite");
  assert.equal(readDbConfig({}, "/r"), null);
});

test("introspectSchema reads a live SQLite database", async (t) => {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = await import("node:sqlite"));
  } catch {
    return t.skip("node:sqlite requires Node >=22.5 (package requires Node >=24)");
  }
  const dir = mkdtempSync(join(tmpdir(), "archmantic-db-"));
  const file = join(dir, "test.sqlite");
  try {
    const db = new DatabaseSync(file);
    db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, bio TEXT)");
    db.exec("CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL)");
    db.close();

    const live = await introspectSchema({ engine: "sqlite", database: "test", file });
    assert.deepEqual(Object.keys(live.tables).sort(), ["posts", "users"]);
    assert.deepEqual(Object.keys(live.tables.users).sort(), ["bio", "email", "id"]);
    assert.equal(live.tables.users.email.nullable, false);
    assert.equal(live.tables.users.bio.nullable, true);

    // end-to-end: migrations missing `bio`, has extra `nickname`
    const r = compareSchema(live, [entity("users", ["id", "email", "nickname"]), entity("posts", ["id", "user_id"])]);
    const users = r.drift.find((d) => d.table === "users");
    assert.deepEqual(users.dbOnly, ["bio"]);
    assert.deepEqual(users.migrationOnly, ["nickname"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
