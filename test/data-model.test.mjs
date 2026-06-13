// Prisma data-model detection → ERD projection. Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectDataModel } from "../dist/analyze/prisma.js";
import { erDiagram } from "../dist/project/index.js";

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

test("erDiagram renders cardinality edges and attribute blocks", () => {
  withSchema((dir) => {
    const entities = detectDataModel(dir);
    const mmd = erDiagram({ dataEntities: entities });
    assert.match(mmd, /^erDiagram/);
    // User has many Post (the array side is the "one").
    assert.match(mmd, /User \|\|--o\{ Post/);
    // PK / FK markers present; relation fields are edges, not attributes.
    assert.match(mmd, /String id PK/);
    assert.match(mmd, /String authorId FK/);
    assert.ok(!/ posts /.test(mmd), "relation field not rendered as an attribute");
  });
});
