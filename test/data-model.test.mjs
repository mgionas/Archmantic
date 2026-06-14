// Data-model detection (Prisma / Drizzle / SQL DDL). Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectDataModel } from "../dist/analyze/datamodel.js";

const SCHEMA = `
datasource db { provider = "postgresql" url = env("DATABASE_URL") }

model User {
  id    String  @id @default(cuid())
  email String  @unique
  name  String?
  role  Role    @default(USER)
  posts Post[]
}

model Post {
  id       String @id
  title    String
  author   User   @relation(fields: [authorId], references: [id])
  authorId String
}

enum Role { USER ADMIN }
`;

function withSchema(fn) {
  const dir = mkdtempSync(join(tmpdir(), "archmantic-prisma-"));
  try {
    mkdirSync(join(dir, "prisma"));
    writeFileSync(join(dir, "prisma", "schema.prisma"), SCHEMA);
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("prisma parser extracts entities, fields, keys, and relations", () => {
  withSchema((dir) => {
    const entities = detectDataModel(dir);
    const byName = Object.fromEntries(entities.map((e) => [e.name, e]));

    // Models become entities; the enum does not.
    assert.deepEqual(entities.map((e) => e.name).sort(), ["Post", "User"]);

    const user = byName.User;
    const id = user.fields.find((f) => f.name === "id");
    assert.ok(id.isId, "id is the primary key");
    assert.ok(user.fields.find((f) => f.name === "email").isUnique, "email is unique");
    assert.ok(user.fields.find((f) => f.name === "name").optional, "name is nullable");
    assert.equal(user.fields.find((f) => f.name === "role").type, "Role", "enum field kept as scalar type");
    const posts = user.fields.find((f) => f.name === "posts");
    assert.ok(posts.list && posts.relationTo === "data:Post", "posts is a to-many relation to Post");

    const post = byName.Post;
    assert.ok(post.fields.find((f) => f.name === "authorId").isForeignKey, "authorId is a foreign key");
    assert.ok(post.fields.find((f) => f.name === "author").relationTo === "data:User", "author relates to User");

    // Grounded with provenance to the schema file.
    assert.match(user.provenance[0].ref, /schema\.prisma:\d+/);
  });
});

const DRIZZLE = `
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
});
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  authorId: integer("author_id").references(() => users.id).notNull(),
});
`;

const SQL = `
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name TEXT
);
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  author_id INTEGER NOT NULL REFERENCES users(id)
);
`;

function withFile(rel, content, fn) {
  const dir = mkdtempSync(join(tmpdir(), "archmantic-dm-"));
  try {
    const parts = rel.split("/");
    if (parts.length > 1) mkdirSync(join(dir, ...parts.slice(0, -1)), { recursive: true });
    writeFileSync(join(dir, ...parts), content);
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("drizzle parser: FK-only relations infer one-to-many", () => {
  withFile("src/db/schema.ts", DRIZZLE, (dir) => {
    const entities = detectDataModel(dir);
    assert.deepEqual(entities.map((e) => e.name).sort(), ["posts", "users"]);
    const posts = entities.find((e) => e.name === "posts");
    const authorId = posts.fields.find((f) => f.name === "authorId");
    assert.ok(authorId.isForeignKey && authorId.relationTo === "data:users", "authorId FK → users");
    assert.ok(!authorId.optional, "notNull column is not optional");
  });
});

test("sql DDL parser: columns, keys, and REFERENCES", () => {
  withFile("migrations/0001_init.sql", SQL, (dir) => {
    const entities = detectDataModel(dir);
    assert.deepEqual(entities.map((e) => e.name).sort(), ["posts", "users"]);
    const users = entities.find((e) => e.name === "users");
    assert.ok(users.fields.find((f) => f.name === "id").isId, "id PRIMARY KEY");
    assert.ok(users.fields.find((f) => f.name === "email").isUnique, "email UNIQUE");
    assert.ok(users.fields.find((f) => f.name === "name").optional, "nullable column");
    const posts = entities.find((e) => e.name === "posts");
    assert.ok(posts.fields.find((f) => f.name === "author_id").relationTo === "data:users", "FK → users");
  });
});
