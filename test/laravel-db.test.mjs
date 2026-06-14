// Laravel migrations → data model. Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectLaravelMigrations } from "../dist/analyze/laravel-db.js";

function withRepo(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), "archmantic-ldb-"));
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

const migration = (body) =>
  `<?php\nreturn new class extends Migration {\n  public function up(): void {\n${body}\n  }\n};`;

test("columns, types, modifiers, and helpers", () => {
  withRepo(
    {
      "database/migrations/2024_01_01_create_leagues.php": migration(`
        Schema::create('leagues', function (Blueprint $table) {
          $table->id();
          $table->string('name')->unique();
          $table->text('about')->nullable();
          $table->integer('size');
          $table->boolean('active');
          $table->timestamps();
          $table->softDeletes();
        });`),
    },
    (dir) => {
      const ents = detectLaravelMigrations(dir);
      const leagues = ents.find((e) => e.name === "leagues");
      assert.ok(leagues, "leagues entity");
      const f = (n) => leagues.fields.find((x) => x.name === n);
      assert.equal(f("id").isId, true);
      assert.equal(f("name").type, "String");
      assert.equal(f("name").isUnique, true);
      assert.equal(f("about").optional, true);
      assert.equal(f("size").type, "Int");
      assert.equal(f("active").type, "Boolean");
      assert.ok(f("created_at") && f("updated_at"), "timestamps()");
      assert.ok(f("deleted_at")?.optional, "softDeletes()");
    },
  );
});

test("foreign keys become relations (constrained + references/on)", () => {
  withRepo(
    {
      "database/migrations/01_tournaments.php": migration("Schema::create('tournaments', function (Blueprint $table) { $table->id(); });"),
      "database/migrations/02_leagues.php": migration(`
        Schema::create('leagues', function (Blueprint $table) {
          $table->id();
          $table->foreignId('tournament_id')->constrained();
          $table->unsignedBigInteger('owner_id');
          $table->foreign('owner_id')->references('id')->on('tournaments');
        });`),
    },
    (dir) => {
      const ents = detectLaravelMigrations(dir);
      const leagues = ents.find((e) => e.name === "leagues");
      const tid = leagues.fields.find((x) => x.name === "tournament_id");
      assert.equal(tid.isForeignKey, true);
      assert.equal(tid.relationTo, "entity:tournaments", "constrained() infers table from column");
      const oid = leagues.fields.find((x) => x.name === "owner_id");
      assert.equal(oid.relationTo, "entity:tournaments", "foreign()->on() resolves table");
    },
  );
});

test("framework scaffolding tables are excluded", () => {
  withRepo(
    {
      "database/migrations/0001_users.php": migration("Schema::create('users', function (Blueprint $table) { $table->id(); });"),
      "database/migrations/0002_cache.php": migration("Schema::create('cache', function (Blueprint $table) { $table->string('key'); });"),
      "database/migrations/0003_jobs.php": migration("Schema::create('jobs', function (Blueprint $table) { $table->id(); });"),
      "database/migrations/0004_sessions.php": migration("Schema::create('sessions', function (Blueprint $table) { $table->string('id'); });"),
    },
    (dir) => {
      const names = detectLaravelMigrations(dir).map((e) => e.name);
      assert.deepEqual(names, ["users"], "cache/jobs/sessions filtered, users kept");
    },
  );
});
